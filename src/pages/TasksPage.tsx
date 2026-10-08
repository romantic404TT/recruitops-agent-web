import { useEffect } from "react";
import { IconButton } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { EmptyState, LoadingRows } from "@/components/ui/States";
import { STATUS_LABELS, TASK_LABELS } from "@/lib/labels";
import { text } from "@/lib/format";
import { useTasksStore, traceDetail, traceTiming, traceTitle, TRACE_RENDER_LIMIT } from "@/stores/tasks";
import { useAssistantStore } from "@/stores/assistant";

const statusLabel = (value: unknown) => STATUS_LABELS[String(value)] ?? text(value, "未知状态");

/** 运行记录（上游 #tasks-view：本地任务历史 + 服务端轨迹 + 选中任务详情）。 */
export default function TasksPage() {
  const traces = useTasksStore((state) => state.traces);
  const tracesLoading = useTasksStore((state) => state.tracesLoading);
  const loadTraces = useTasksStore((state) => state.loadTraces);
  const selectedTaskId = useTasksStore((state) => state.selectedTaskId);
  const selectTask = useTasksStore((state) => state.selectTask);
  const tasks = useAssistantStore((state) => state.tasks);
  const selectedLocal = useAssistantStore((state) => state.tasks).find(
    (task) => task.local_task_id === selectedTaskId,
  );

  useEffect(() => {
    if (!traces.length) void loadTraces();
  }, [traces.length, loadTraces]);

  return (
    <section className="view-panel is-visible" data-view-panel="tasks" aria-labelledby="tasks-heading">
      <SectionHeading
        eyebrow="可追溯执行"
        titleId="tasks-heading"
        title="任务轨迹"
        description="保留任务计划、工具调用、耗时与安全停止原因。"
        actions={<IconButton icon="refresh" label="刷新轨迹" title="刷新轨迹" onClick={() => void loadTraces()} />}
      />
      <div className="tasks-layout">
        <section className="workspace-section" aria-labelledby="task-history-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">本次会话</p>
              <h3 id="task-history-heading">任务记录</h3>
            </div>
            <span className="muted-label">{`${tasks.length} 条`}</span>
          </div>
          <div className="data-list" data-state={tasks.length ? "ready" : "empty"}>
            {!tasks.length ? (
              <EmptyState title="暂无任务记录" detail="执行一次助理任务后会显示在这里。" />
            ) : null}
            {tasks
              .slice()
              .reverse()
              .map((task) => (
                <button
                  key={task.local_task_id}
                  type="button"
                  className="history-row"
                  aria-pressed={selectedTaskId === task.local_task_id}
                  onClick={() => selectTask(task.local_task_id)}
                >
                  <strong className="task-title">
                    {task.user_request || task.display_label || TASK_LABELS[task.task_type] || text(task.task_type)}
                  </strong>
                  <span className="task-meta">
                    {`${task.display_label || TASK_LABELS[task.task_type] || text(task.task_type)} · ${statusLabel(task.status)} · ${text(task.steps, 0)} 步${task.local_preview ? " · 本地预览" : ""}`}
                  </span>
                </button>
              ))}
          </div>
        </section>

        <section className="workspace-section" aria-labelledby="trace-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">服务端记录</p>
              <h3 id="trace-heading">执行轨迹</h3>
            </div>
            <span className="muted-label">{`${traces.length} 次调用`}</span>
          </div>
          <div className="trace-list" data-state={tracesLoading ? "loading" : "ready"}>
            {tracesLoading && !traces.length ? <LoadingRows rows={3} /> : null}
            {!traces.length && !tracesLoading ? (
              <EmptyState title="暂无执行轨迹" detail="执行一次助理任务后会显示工具调用。" />
            ) : null}
            {traces
              .slice()
              .reverse()
              .slice(0, TRACE_RENDER_LIMIT)
              .map((trace, index) => (
                <div key={index} className="trace-row">
                  <div className="trace-main">
                    <strong className="trace-name">{traceTitle(trace)}</strong>
                    <span className="trace-timing">{traceTiming(trace)}</span>
                  </div>
                  <span className="trace-meta">{traceDetail(trace)}</span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section className="workspace-section" aria-labelledby="selected-task-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">结果详情</p>
            <h3 id="selected-task-heading">选中任务</h3>
          </div>
        </div>
        <div className="task-result" data-state={selectedLocal ? "ready" : "empty"}>
          {!selectedLocal ? (
            <EmptyState title="选择一条任务记录" detail="这里会显示计划、结果、证据和错误信息。" />
          ) : (
            <>
              {Array.isArray(selectedLocal.plan) && selectedLocal.plan.length ? (
                <div className="result-block">
                  <h4 className="result-block-title">任务计划</h4>
                  <ol className="plan-list">
                    {(selectedLocal.plan as string[]).map((step, index) => (
                      <li key={index} className="plan-item">
                        <span className="plan-index">{`${index + 1}.`}</span>
                        <span>{text(step)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {selectedLocal.answer ? (
                <div className="result-block">
                  <h4 className="result-block-title">回答</h4>
                  <pre className="task-answer">{String(selectedLocal.answer)}</pre>
                </div>
              ) : null}
              {selectedLocal.error ? (
                <div className="result-block">
                  <h4 className="result-block-title">错误信息</h4>
                  <p className="inline-error">{String(selectedLocal.error)}</p>
                </div>
              ) : null}
              {Array.isArray(selectedLocal.stages) && selectedLocal.stages.length ? (
                <div className="result-block">
                  <h4 className="result-block-title">执行阶段</h4>
                  <ol className="stage-list">
                    {(selectedLocal.stages as Array<{ label?: string; event_type?: string }>).map((stage, index) => (
                      <li key={index}>{text(stage.label, stage.event_type ?? "—")}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="result-block">
                <h4 className="result-block-title">原始记录</h4>
                <pre>{JSON.stringify(selectedLocal, null, 2)}</pre>
              </div>
            </>
          )}
        </div>
      </section>
    </section>
  );
}
