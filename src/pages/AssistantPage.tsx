import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, LoadingRows } from "@/components/ui/States";
import { UiIcon } from "@/components/ui/UiIcon";
import { CODEX_STATUS_KEYS, CODEX_STATUS_LABELS, CONTEXT_LABELS, friendlyRuntimeProgress, localizeCodexRuntimeMessage } from "@/lib/labels";
import { QUICK_QUESTIONS } from "@/types/assistant";
import { codexThreadIdOf, codexThreadTitle, codexThreadUpdatedAt, text } from "@/lib/format";
import { useAssistantStore, mapIntent } from "@/stores/assistant";
import { useSystemStore } from "@/stores/system";
import type { MessageRecord } from "@/types/assistant";

/** 极简 Markdown：只处理标题、列表、粗体、行内代码与安全链接。 */
function renderRichText(body: string) {
  const lines = localizeCodexRuntimeMessage(body).split(/\r?\n/);
  return lines.map((line, index) => {
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const Level = (["h4", "h4", "h5", "h5", "h6"] as const)[heading[1].length] ?? "h6";
      return <Level key={index}>{heading[2]}</Level>;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      return (
        <li key={index} className="md-li">
          {line.replace(/^\s*[-*]\s+/, "")}
        </li>
      );
    }
    if (!line.trim()) return <br key={index} />;
    return <p key={index}>{line}</p>;
  });
}

function MessageBubble({ record }: { record: MessageRecord }) {
  const tasks = useAssistantStore((state) => state.tasks);
  const isUser = record.role === "user";
  const result = record.task_id
    ? tasks.find((task) => task.local_task_id === record.task_id || task.task_id === record.task_id)
    : record.result;
  return (
    <article className={`message message--${isUser ? "user" : "assistant"}`} data-message-id={record.id} data-streaming={record.streaming ? "true" : undefined}>
      <div className="message-meta">
        <strong>{isUser ? "你" : "求职助理"}</strong>
        <span>{record.created_at ? new Date(record.created_at).toLocaleTimeString() : "刚刚"}</span>
      </div>
      <div className="message-copy">{isUser ? <p>{text(record.body, "")}</p> : renderRichText(record.body)}</div>
      {result ? (
        <details className="message-result-details">
          <summary>查看执行过程与结构化结果</summary>
          <div className="message-result">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </details>
      ) : null}
    </article>
  );
}

/** 求职助理（上游 #assistant-view：会话列表 + 对话区 + 上下文侧栏）。 */
export default function AssistantPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const messages = useAssistantStore((state) => state.messages);
  const conversations = useAssistantStore((state) => state.conversations);
  const threadId = useAssistantStore((state) => state.threadId);
  const cursor = useAssistantStore((state) => state.cursor);
  const listLoading = useAssistantStore((state) => state.listLoading);
  const listError = useAssistantStore((state) => state.listError);
  const historyError = useAssistantStore((state) => state.historyError);
  const eventState = useAssistantStore((state) => state.eventState);
  const liveRun = useAssistantStore((state) => state.liveRun);
  const status = useAssistantStore((state) => state.status);
  const context = useAssistantStore((state) => state.context);
  const store = useAssistantStore.getState;
  const refreshBusinessData = useSystemStore((state) => state.refreshBusinessData);

  const [draft, setDraft] = useState(params.get("draft") ?? params.get("prompt") ?? "");
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [stopVisible, setStopVisible] = useState(false);
  const [formError, setFormError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const availability = store().availability();
  const ready = availability.status === "ready";

  useEffect(() => {
    const next = params.get("draft") ?? params.get("prompt");
    if (next) setDraft(next);
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, liveRun.detail]);

  const intent = mapIntent(draft);
  const contextEntries = Object.entries(context).filter(([, value]) => value !== null && value !== undefined && value !== "");

  const send = async () => {
    const question = draft.trim();
    if (!question) {
      setFormError("请输入问题。");
      return;
    }
    setFormError("");
    setStopVisible(true);
    setDraft("");
    await store().ask(question, selectedJob);
    setStopVisible(false);
    void refreshBusinessData();
  };

  return (
    <section className="view-panel agent-chat-view is-visible" data-view-panel="assistant" aria-labelledby="assistant-heading">
      <div className="agent-workspace">
        <aside className="conversation-rail" aria-label="历史会话">
          <div className="conversation-rail-head">
            <div>
              <p className="eyebrow">会话</p>
              <h2 id="assistant-heading">求职助理</h2>
            </div>
            <IconButton
              icon="plus"
              label="新建会话"
              title="新建会话"
              disabled={!ready}
              onClick={async () => {
                await store().createThread();
                await store().loadThreadList();
              }}
            />
          </div>
          <div className="conversation-list" data-state={listLoading ? "loading" : "ready"} aria-busy={listLoading}>
            {!conversations.length && listLoading ? <LoadingRows rows={3} /> : null}
            {!conversations.length && !listLoading && listError ? <EmptyState title="会话列表暂不可用" detail={listError} /> : null}
            {!conversations.length && !listLoading && !listError ? <EmptyState title="暂无历史会话" detail="还没有可恢复的 Codex 会话。" /> : null}
            {conversations.map((conversation) => {
              const id = codexThreadIdOf(conversation);
              if (!id) return null;
              return (
                <div key={id} className="conversation-list-item">
                  <button
                    type="button"
                    className={`conversation-item${id === threadId ? " is-active" : ""}`}
                    title={codexThreadTitle(conversation)}
                    onClick={() => void store().loadConversation(id)}
                  >
                    <strong>{codexThreadTitle(conversation)}</strong>
                    <span>{`${conversation.turn_count ?? conversation.turnCount ?? (Array.isArray(conversation.turns) ? conversation.turns.length : null) ?? 0} 轮 · ${codexThreadUpdatedAt(conversation)}`}</span>
                  </button>
                  <button type="button" className="conversation-delete-button" title="删除会话" aria-label={`删除会话：${codexThreadTitle(conversation)}`} onClick={() => void store().deleteConversation(id)}>
                    <UiIcon name="close" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="conversation-list-controls">
            <span className="conversation-list-status" role="status">
              {listLoading ? "正在加载会话…" : listError || (cursor ? "还有历史会话" : conversations.length ? "已加载全部会话" : "")}
            </span>
            {cursor ? (
              <Button variant="ghost" disabled={listLoading} onClick={() => void store().loadThreadList({ append: true })}>
                {listLoading ? "加载中…" : "加载更多"}
              </Button>
            ) : null}
          </div>
          <div className="conversation-rail-footer">
            <Button variant="ghost" disabled={!ready || !threadId} onClick={() => void store().deleteConversation(threadId)}>
              删除当前会话
            </Button>
          </div>
        </aside>

        <section className="chat-pane" aria-labelledby="messages-heading">
          <header className="chat-header">
            <div>
              <div className="chat-title-row">
                <h3 id="messages-heading">当前任务</h3>
                <span className="connection-label">{status.message}</span>
              </div>
              <div className="context-chip-list" aria-label="当前上下文">
                {contextEntries.slice(0, 4).map(([key, value]) => (
                  <span key={key} className="context-chip">{`${CONTEXT_LABELS[key] ?? key}：${text(value)}`}</span>
                ))}
              </div>
              {!ready ? (
                <div className="codex-event-strip" role="status" aria-label="Codex 事件状态">
                  {CODEX_STATUS_KEYS.map((key) => (
                    <span key={key} className="codex-event-chip" data-codex-status={key}>
                      {`${CODEX_STATUS_LABELS[key]} · ${eventState[key]?.value ?? "等待"}`}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="chat-header-actions">
              <span className="context-policy-label" title="长对话达到阈值后由 Codex Harness 自动压缩">上下文压缩已启用</span>
              <span className="conversation-thread-label">{threadId ? threadId : "新会话"}</span>
            </div>
          </header>

          {!ready ? (
            <div className="assistant-availability" role="status" data-state={availability.status}>
              <p>{availability.message}</p>
              <Button variant="text" onClick={() => navigate("/configuration")}>
                {availability.status === "missing_model" ? "配置模型连接" : "查看模型配置"}
              </Button>
              <Button variant="text" onClick={() => void store().refreshHealth()}>
                重新检查
              </Button>
            </div>
          ) : null}

          <div className="message-list agent-message-list" aria-live="polite" aria-relevant="additions" aria-atomic="false">
            {historyError ? <EmptyState title="会话恢复失败" detail={historyError} /> : null}
            {!messages.length && !historyError ? (
              <article className="message message--assistant">
                <div className="message-meta">
                  <strong>求职助理</strong>
                  <span>待命</span>
                </div>
                <p>{ready ? "发送第一条问题开始对话。简历和岗位关键词可稍后配置。" : availability.message}</p>
              </article>
            ) : null}
            {messages.map((record) => <MessageBubble key={record.id} record={record} />)}
            <div ref={bottomRef} />
          </div>

          {liveRun.visible ? (
            <div className="live-run" role="status" aria-live="polite">
              <span className="live-run-pulse" aria-hidden="true" />
              <div>
                <strong>{liveRun.label || "等待 Codex 事件"}</strong>
                <small>{friendlyRuntimeProgress(liveRun.detail)}</small>
              </div>
            </div>
          ) : null}

          <form
            className="chat-composer"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <div className="assistant-job-context">
              {selectedJob ? (
                <>
                  <span>{`已关联岗位：${selectedJob}`}</span>
                  <Button variant="ghost" onClick={() => setSelectedJob("")} aria-label="移除当前岗位">×</Button>
                </>
              ) : null}
            </div>
            <label className="sr-only" htmlFor="assistant-message">
              向求职助理提问
            </label>
            <textarea
              id="assistant-message"
              className="assistant-message-input"
              rows={2}
              autoComplete="off"
              required
              disabled={!ready}
              placeholder="询问岗位、投递进度、邮箱或今天的安排"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="composer-footer">
              <div className="assistant-intent" role="status">
                <span className={`status-dot status-dot--${ready ? "ok" : "warn"}`} aria-hidden="true" />
                <span>{draft.trim() ? `识别为：${intent.label}${intent.matched ? "" : "（默认岗位查询）"}` : "等待识别问题"}</span>
              </div>
              <div className="composer-actions">
                {stopVisible ? (
                  <Button variant="ghost" onClick={() => void store().stop()}>
                    停止
                  </Button>
                ) : null}
                <Button variant="primary" type="submit" disabled={!ready}>
                  发送
                </Button>
              </div>
            </div>
            {formError ? <div className="inline-error" role="alert">{formError}</div> : null}
          </form>
        </section>

        <aside className="assistant-context-panel" aria-label="任务上下文">
          <section className="context-section">
            <div className="context-section-head">
              <p className="eyebrow">快捷入口</p>
              <span>{QUICK_QUESTIONS.length}</span>
            </div>
            <div className="command-list">
              {QUICK_QUESTIONS.map((item) => (
                <button
                  key={item.task}
                  type="button"
                  className="command-button"
                  onClick={() => {
                    setDraft(item.question);
                    if (!ready) return;
                    void store().ask(item.question);
                    void refreshBusinessData();
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="context-section">
            <div className="context-section-head">
              <p className="eyebrow">当前上下文</p>
              <span>{contextEntries.length}</span>
            </div>
            <dl className="context-facts">
              {contextEntries.length ? (
                contextEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{CONTEXT_LABELS[key] ?? key}</dt>
                    <dd>{text(value)}</dd>
                  </div>
                ))
              ) : (
                <div>
                  <dt>状态</dt>
                  <dd>尚未选择岗位或公司</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="context-section context-section--safety">
            <div className="safety-line">
              <span className="status-dot status-dot--ok" aria-hidden="true" />
              <strong>审批边界已启用</strong>
            </div>
            <Button variant="text" onClick={() => navigate("/approvals")}>查看审批中心</Button>
            <Button variant="text" onClick={() => navigate("/tasks")}>查看完整轨迹</Button>
          </section>
        </aside>
      </div>
    </section>
  );
}
