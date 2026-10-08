import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { scheduleEventTitle } from "@/lib/format";
import { useApplicationsStore } from "@/stores/applications";
import { useScheduleStore } from "@/stores/schedule";
import type { ScheduleEvent } from "@/types/domain";

const TIME_KINDS = [
  { value: "appointment", label: "约定事项" },
  { value: "deadline", label: "截止提醒" },
  { value: "unspecified", label: "时间未定" },
] as const;

/** 添加/编辑日程（上游 #schedule-editor-dialog，按路由分成 new 与 edit/:eventId）。 */
export default function ScheduleEditorDialog() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId?: string }>();
  const all = useScheduleStore((state) => state.all);
  const save = useScheduleStore((state) => state.save);
  const applications = useApplicationsStore((state) => state.items);
  const existing: ScheduleEvent | null = useMemo(
    () => (eventId ? all.find((item) => item.id === eventId) ?? null : null),
    [all, eventId],
  );

  const [form, setForm] = useState({
    title: existing ? scheduleEventTitle(existing) : "",
    event_type: existing?.event_type ?? "",
    event_date: existing?.event_date ?? "",
    event_time: existing?.event_time ? existing.event_time.slice(0, 5) : "",
    time_kind: existing?.time_kind ?? "appointment",
    company_name: existing?.company_name ?? "",
    job_title: existing?.job_title ?? "",
    application_id: existing?.application_id ?? "",
    location_or_link: existing?.location_or_link ?? "",
    note: existing?.note ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => navigate("/schedule", { replace: true });
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open
      onClose={close}
      labelledby="schedule-editor-heading"
      kicker={existing ? "调整当前安排" : "手动记录安排"}
      title={existing ? "编辑日程" : "添加日程"}
      closeLabel="关闭日程编辑"
    >
      <form
        className="schedule-editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.title.trim()) return setError("请填写日程标题。");
          if (!form.company_name.trim()) return setError("请填写公司。");
          if (!form.event_date && form.event_time) return setError("未填写日期时不能填写时间。");
          setBusy(true);
          setError("");
          try {
            await save(
              {
                title: form.title.trim(),
                event_date: form.event_date || null,
                event_time: form.event_time || null,
                event_type: form.event_type.trim() || "其他",
                company_name: form.company_name.trim(),
                job_title: form.job_title.trim(),
                application_id: form.application_id || null,
                location_or_link: form.location_or_link.trim() || null,
                note: form.note.trim() || null,
                time_kind: form.time_kind,
              },
              existing,
            );
            close();
          } catch (caught) {
            setError(`日程保存失败：${(caught as Error).message}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="schedule-editor-grid">
          <label>标题<input maxLength={512} required value={form.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label>
            事件类型
            <input maxLength={64} placeholder="面试 / 笔试 / 截止" required value={form.event_type} onChange={(e) => set("event_type", e.target.value)} />
          </label>
          <label>日期<input type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} /></label>
          <label>时间<input type="time" value={form.event_time} onChange={(e) => set("event_time", e.target.value)} /></label>
          <label>
            时间含义
            <select value={form.time_kind} onChange={(e) => set("time_kind", e.target.value)}>
              {TIME_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>公司<input maxLength={255} required value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></label>
          <label>岗位<input maxLength={512} placeholder="可留空" value={form.job_title} onChange={(e) => set("job_title", e.target.value)} /></label>
          <label>
            关联投递
            <select value={form.application_id} onChange={(e) => set("application_id", e.target.value)}>
              <option value="">无关联</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {`${application.company_name} · ${application.job_title}`}
                </option>
              ))}
              {form.application_id && !applications.some((item) => item.id === form.application_id) ? (
                <option value={form.application_id}>{`当前绑定：${form.application_id}`}</option>
              ) : null}
            </select>
          </label>
          <label className="schedule-editor-field--wide">
            位置或链接<input maxLength={2048} value={form.location_or_link} onChange={(e) => set("location_or_link", e.target.value)} />
          </label>
          <label className="schedule-editor-field--wide">
            备注<textarea rows={4} maxLength={4000} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </label>
          {error ? <p className="schedule-editor-field--wide inline-error" role="alert">{error}</p> : null}
        </div>
        <DialogActions>
          <Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {existing ? "保存修改" : "添加日程"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
