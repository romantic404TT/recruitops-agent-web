import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button, IconButton } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/States";
import { UiIcon } from "@/components/ui/UiIcon";
import { APPLICATION_COLUMNS, APPLICATION_STAGE_LABELS } from "@/lib/labels";
import { applicationAvatar, compactDate, text } from "@/lib/format";
import { useApplicationsStore } from "@/stores/applications";
import { useScheduleStore } from "@/stores/schedule";
import { showToast } from "@/stores/toast";
import { useState } from "react";
import type { Application, ApplicationStage } from "@/types/domain";
import type { ApplicationResult } from "@/types/localUi";

const RESULT_CHOICES: ApplicationResult[] = ["待", "进行中", "通过", "淘汰", "放弃"];
const EVENT_KINDS = ["测评", "笔试", "面试", "其他"];

function ApplicationCard({ application }: { application: Application }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const updateStage = useApplicationsStore((state) => state.updateStage);
  const saveRecordUrl = useApplicationsStore((state) => state.saveRecordUrl);
  const remove = useApplicationsStore((state) => state.remove);
  const addEvent = useScheduleStore((state) => state.save);

  const [stage, setStage] = useState<ApplicationStage>(application.stage);
  const [result, setResult] = useState<ApplicationResult>("进行中");
  const [note, setNote] = useState(application.note ?? "");
  const [recordUrl, setRecordUrl] = useState(application.record_url ?? "");
  const [eventKind, setEventKind] = useState("面试");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);

  const avatar = applicationAvatar(application.company_name);
  const history = application.stage_history ?? [];
  const latest = history[history.length - 1] ?? {};
  const fallbackResult = ["rejected", "withdrawn"].includes(application.stage) ? "已结束" : "进行中";
  const run = async (action: () => Promise<unknown>, failure: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showToast(`${failure}${(error as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="application-card">
      <div className="application-card-heading">
        <span className="application-avatar" data-tone={avatar.tone}>
          {avatar.label}
        </span>
        <div className="application-card-identity">
          <strong>{application.job_title}</strong>
          <p className="application-company">{text(application.company_name, "公司待确认")}</p>
        </div>
        <button
          type="button"
          className="application-card-menu"
          title={open ? "收起编辑" : "展开编辑"}
          aria-label={`编辑 ${application.company_name} 的投递记录`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <UiIcon name="more" />
        </button>
      </div>

      <div className="application-card-status">
        <span className="application-result">{latest.result ?? fallbackResult}</span>
        <span className="application-updated">{`更新于 ${compactDate(application.updated_at)}`}</span>
      </div>

      {application.note ? <p className="application-note">{application.note}</p> : null}

      <div className="application-card-actions">
        <div className="application-card-links">
          {application.record_url ? (
            <a className="text-action" href={application.record_url} target="_blank" rel="noreferrer">
              查看投递进度 ›
            </a>
          ) : null}
          {application.job_id ? (
            <button type="button" className="text-action" onClick={() => navigate(`/jobs/${encodeURIComponent(application.job_id!)}`)}>
              岗位详情
            </button>
          ) : null}
          {history.length ? (
            <details className="application-history" open={expanded} onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}>
              <summary>{`阶段历史 (${history.length})`}</summary>
              <ol>
                {history.slice().reverse().map((entry, index) => {
                  const parts = [
                    APPLICATION_STAGE_LABELS[(entry.stage ?? entry.to_stage ?? entry.status) as ApplicationStage] ??
                      text(entry.stage ?? entry.to_stage ?? entry.status, "阶段待确认"),
                  ];
                  if (entry.result) parts.push(String(entry.result));
                  parts.push(compactDate(entry.changed_at ?? entry.at ?? entry.created_at ?? entry.date));
                  return (
                    <li key={index} className="application-history-entry">
                      <span className="application-history-copy">{parts.join(" · ")}</span>
                      <span className="history-source history-source--record">
                        {`来源：${applicationSourceLabel(entry)}`}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </details>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="application-editor" hidden={false}>
          <label className="application-editor-field">
            阶段
            <select value={stage} onChange={(event) => setStage(event.target.value as ApplicationStage)}>
              {Object.entries(APPLICATION_STAGE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="application-editor-field">
            结果
            <select value={result} onChange={(event) => setResult(event.target.value as ApplicationResult)}>
              {RESULT_CHOICES.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
          </label>
          <label className="application-editor-field">
            备注
            <textarea value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => updateStage(application.id, { stage, result, note, expected_updated_at: application.updated_at }),
                "更新失败：",
              )
            }
          >
            更新
          </Button>

          <label className="application-editor-field">
            官网投递进度页地址
            <input type="url" required maxLength={2048} value={recordUrl} onChange={(event) => setRecordUrl(event.target.value)} />
          </label>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => saveRecordUrl(application.id, { record_url: recordUrl.trim(), expected_updated_at: application.updated_at }),
                "保存失败：",
              )
            }
          >
            保存进度页链接
          </Button>

          <label className="application-editor-field">
            日程
            <select value={eventKind} onChange={(event) => setEventKind(event.target.value)}>
              {EVENT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
          <label className="application-editor-field">
            日期
            <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
          </label>
          <label className="application-editor-field">
            时间
            <input type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
          </label>
          <label className="application-editor-field">
            日程备注
            <input maxLength={4000} value={eventNote} onChange={(event) => setEventNote(event.target.value)} />
          </label>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!eventDate && eventTime) {
                showToast("未填写日期时不能填写时间。", "error");
                return;
              }
              run(
                () =>
                  addEvent({
                    title: `${application.company_name} · ${eventKind}`,
                    event_type: eventKind,
                    event_date: eventDate || null,
                    event_time: eventTime || null,
                    company_name: application.company_name,
                    job_title: application.job_title,
                    application_id: application.id,
                    location_or_link: null,
                    note: eventNote,
                    time_kind: "appointment",
                  }),
                "添加日程失败：",
              );
            }}
          >
            添加日程
          </Button>

          <Button variant="secondary" onClick={() => setDeleting((value) => !value)}>
            删除投递记录
          </Button>
          {deleting ? (
            <div className="application-delete-confirmation" role="group" aria-label="确认删除投递记录">
              <strong>{`${application.company_name} · ${application.job_title}`}</strong>
              <p>将删除这条投递记录及关联日程；邮件保留，仅解除关联。</p>
              {deleteError ? <p className="inline-error application-delete-error" role="alert">{deleteError}</p> : null}
              <div className="application-delete-actions">
                <Button variant="secondary" onClick={() => { setDeleting(false); setDeleteError(""); }}>
                  取消
                </Button>
                <Button
                  className="application-delete-submit"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setDeleteError("");
                    try {
                      await remove(application.id, application.updated_at);
                      setDeleting(false);
                      await Promise.all([
                        useApplicationsStore.getState().load(),
                        useScheduleStore.getState().loadFull(),
                      ]);
                      showToast("投递记录已删除", "success");
                    } catch (error) {
                      setDeleteError(`删除未完成：${(error as Error).message}`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  确认删除
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function applicationSourceLabel(entry: Record<string, unknown>): string {
  const explicit = entry.source_label ?? entry.source_name;
  if (explicit) {
    const label = String(explicit);
    if (/mail|邮箱|邮件/i.test(label)) return "招聘邮件";
    if (/edge|官网|browser/i.test(label)) return "Edge 官网";
    return label;
  }
  const source = [entry.source, entry.source_type, entry.source_ref].filter(Boolean).join(" ").toLowerCase();
  if (/recruitment[_ -]?mail|mail:|imap|邮件|邮箱/.test(source)) return "招聘邮件";
  if (/edge|browser|application[_ -]?status[_ -]?review|官网/.test(source)) return "Edge 官网";
  return "历史记录";
}

/** 投递记录看板（上游 #applications-view）。 */
export default function ApplicationsPage() {
  const items = useApplicationsStore((state) => state.items);
  const total = useApplicationsStore((state) => state.total);
  const loading = useApplicationsStore((state) => state.loading);
  const error = useApplicationsStore((state) => state.error);
  const load = useApplicationsStore((state) => state.load);
  const navigate = useNavigate();

  useEffect(() => {
    if (!items.length) void load();
  }, [items.length, load]);

  return (
    <section className="view-panel is-visible" data-view-panel="applications" aria-labelledby="applications-heading">
      <SectionHeading
        titleId="applications-heading"
        title="投递记录"
        description={`步骤看所在列、卡面只看结果 · 共 ${total} 条`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/applications/new")}>
              手动添加
            </Button>
            <IconButton icon="refresh" label="刷新投递记录" title="刷新投递记录" onClick={() => void load()} />
          </>
        }
      />
      <div className="application-summary" aria-label="投递漏斗">
        {APPLICATION_COLUMNS.map((column) => (
          <div key={column.key} className={`application-summary-item application-summary-item--${column.key}`}>
            <span className="application-summary-icon">
              <UiIcon name={column.key === "closed" ? "close" : (column.key as "applied" | "written" | "interview" | "offer")} />
            </span>
            <div className="application-summary-copy">
              <span>{column.label}</span>
              <strong>{items.filter((item) => column.stages.includes(item.stage)).length}</strong>
              <small>当前阶段记录</small>
            </div>
          </div>
        ))}
      </div>
      <div className="application-kanban" data-state={loading ? "loading" : "ready"}>
        {loading && !items.length ? <LoadingRows rows={3} /> : null}
        {!loading && error ? <ErrorState title="投递记录加载失败" detail={error} /> : null}
        {!loading && !error && !items.length ? (
          <EmptyState title="暂无投递记录" detail="可以先从岗位列表一键记录投递。" />
        ) : null}
        {APPLICATION_COLUMNS.map((column) => {
          const columnItems = items.filter((item) => column.stages.includes(item.stage));
          return (
            <section key={column.key} className={`kanban-column kanban-column--${column.key}`}>
              <header className="kanban-column-header">
                <h3>{column.label}</h3>
                <span className="kanban-count">{columnItems.length}</span>
              </header>
              <div className="kanban-list">
                {columnItems.length ? (
                  columnItems.map((application) => <ApplicationCard key={application.id} application={application} />)
                ) : (
                  <div className="kanban-empty">暂无记录</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <Outlet />
    </section>
  );
}
