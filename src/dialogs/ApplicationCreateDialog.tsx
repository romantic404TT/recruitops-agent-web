import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { APPLICATION_STAGE_LABELS } from "@/lib/labels";
import { useApplicationsStore } from "@/stores/applications";
import type { ApplicationStage } from "@/types/domain";

/** 手动添加投递（上游 #application-create-dialog）。 */
export default function ApplicationCreateDialog() {
  const navigate = useNavigate();
  const createManual = useApplicationsStore((state) => state.createManual);
  const [form, setForm] = useState({
    company_name: "",
    job_title: "",
    stage: "applied" as ApplicationStage,
    record_url: "",
    note: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => navigate("/applications", { replace: true });
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open onClose={close} labelledby="application-create-heading" title="手动添加投递">
      <form
        className="schedule-editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.company_name.trim() || !form.job_title.trim()) {
            setError("公司名称与岗位名称都必须填写。");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await createManual({
              company_name: form.company_name.trim(),
              job_title: form.job_title.trim(),
              stage: form.stage,
              record_url: form.record_url.trim() || null,
              note: form.note.trim(),
            });
            close();
          } catch (caught) {
            setError(`保存失败：${(caught as Error).message}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="schedule-editor-grid">
          <label>
            公司名称
            <input maxLength={255} required value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </label>
          <label>
            岗位名称
            <input maxLength={512} required value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
          </label>
          <label>
            当前阶段
            <select value={form.stage} onChange={(e) => set("stage", e.target.value)}>
              {Object.entries(APPLICATION_STAGE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="schedule-editor-field--wide">
            官网投递进度页地址（选填）
            <input type="url" maxLength={2048} value={form.record_url} onChange={(e) => set("record_url", e.target.value)} />
          </label>
          <label className="schedule-editor-field--wide">
            备注（选填）
            <textarea rows={3} maxLength={4000} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </label>
          {error ? <p className="schedule-editor-field--wide inline-error" role="alert">{error}</p> : null}
        </div>
        <DialogActions>
          <Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" type="submit" disabled={busy}>保存投递</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
