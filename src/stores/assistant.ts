import { create } from "zustand";
import { api, authHeaders } from "@/lib/http";
import {
  codexContentText,
  codexThreadIdOf,
  codexThreadPayload,
  text,
} from "@/lib/format";
import {
  CODEX_STREAM_MAX_RECONNECTS,
  INTENT_RULES,
  STORAGE_BULKY_KEYS,
  STORAGE_KEYS,
  STORAGE_SECRET_KEYS,
  TASK_LABELS,
} from "@/lib/labels";
import {
  createDedupe,
  eventDetail,
  friendlyRuntimeError,
  parseSseBlock,
  pick,
} from "@/lib/sse";
import type { CodexContent, CodexHealth, CodexThread } from "@/types/codex";
import type { LocalTask, MessageRecord } from "@/types/assistant";
import {
  PERSIST_MESSAGE_LIMIT,
  PERSIST_TASK_LIMIT,
} from "@/types/assistant";
import { setNavCounts } from "./navCounts";
import { showToast } from "./toast";

export type CodexStatusTone = "ok" | "warn" | "error" | "active" | "";

export interface CodexEventCell {
  value: string;
  tone: CodexStatusTone;
}

export interface AssistantAvailabilityResult {
  status: string;
  message: string;
}

const AVAILABILITY_MESSAGES: Record<string, string> = {
  missing_model:
    "尚未配置模型连接。请填写服务地址、模型名称和 API 密钥并保存；无需先上传简历或填写岗位关键词。",
  disabled: "求职助理已在高级配置中关闭。可在模型连接的高级设置中改为随模型启用。",
  restart_required:
    "模型配置已保存，重启桌面后生效。请先保存当前工作；不会自动重启。",
};

/** 上游 assistantAvailability()（app.js:533）—— 决定输入框是否可用。 */
export function computeAvailability(state: {
  assistantConfigurationStatus?: string;
  codexEnabled: boolean | null;
  codexReady: boolean;
  codexHealth: CodexHealth | null;
}): AssistantAvailabilityResult {
  const configured = state.assistantConfigurationStatus;
  if (configured && AVAILABILITY_MESSAGES[configured]) {
    return { status: configured, message: AVAILABILITY_MESSAGES[configured] };
  }
  if (state.codexEnabled === true && state.codexReady === true) {
    return { status: "ready", message: "求职助理已就绪" };
  }
  const healthState = state.codexHealth?.state;
  if (["failed", "error", "unavailable"].includes(String(healthState))) {
    return {
      status: "runtime_failed",
      message:
        "本地助理服务连接失败。请重新检查；若仍失败，请查看桌面服务诊断。无需重复填写简历或模型密钥。",
    };
  }
  return {
    status: "checking",
    message: "正在等待助理配置和本地服务就绪，可重新检查或查看模型连接。",
  };
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// -------------------------------------------------------------- 本地会话落盘

function readStorage(key: string): string {
  try {
    return globalThis.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* 无痕模式下 storage 可能被禁用，上游同样静默忽略 */
  }
}

/** 上游 redactStorageValue：密钥不落盘、超长正文换成占位串、字符串截 2000。 */
export function redactStorageValue(value: unknown, key = ""): unknown {
  if (STORAGE_SECRET_KEYS.test(key)) return undefined;
  if (STORAGE_BULKY_KEYS.test(key)) return "[未保存到本地会话]";
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => redactStorageValue(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([childKey, childValue]) => [childKey, redactStorageValue(childValue, childKey)])
        .filter(([, childValue]) => childValue !== undefined),
    );
  }
  return value;
}

function loadStoredConversation(): {
  codexThreadId: string;
  messages: MessageRecord[];
  tasks: LocalTask[];
} {
  let recent: Record<string, unknown> = {};
  try {
    recent = JSON.parse(readStorage(STORAGE_KEYS.recent) || "{}");
  } catch {
    recent = {};
  }
  const codexThreadId =
    readStorage(STORAGE_KEYS.codexThread) ||
    (typeof recent.codexThreadId === "string" ? recent.codexThreadId : "");
  if (codexThreadId) writeStorage(STORAGE_KEYS.codexThread, codexThreadId);
  return {
    codexThreadId,
    messages:
      codexThreadId && Array.isArray(recent.messages)
        ? (recent.messages as MessageRecord[])
        : [],
    tasks: codexThreadId && Array.isArray(recent.tasks) ? (recent.tasks as LocalTask[]) : [],
  };
}

// -------------------------------------------------------------- store

interface AssistantState {
  messages: MessageRecord[];
  tasks: LocalTask[];
  selectedTaskId: string | null;

  codexHealth: CodexHealth | null;
  codexEnabled: boolean | null;
  codexReady: boolean;
  assistantConfigurationStatus: string | undefined;
  healthRequestId: number;

  threadId: string;
  threadMetadata: CodexThread | null;
  conversations: CodexThread[];
  cursor: string;
  listLoading: boolean;
  listError: string;
  pendingThreadId: string;
  historyLoading: boolean;
  historyError: string;
  historyRequestId: number;

  turnId: string;
  turnReady: Promise<string> | null;
  stopRequested: boolean;
  controller: AbortController | null;
  eventState: Record<string, CodexEventCell>;

  context: Record<string, unknown>;
  liveRun: { visible: boolean; label: string; detail: string };
  status: { message: string; kind: "ok" | "warn" | "error" };

  setAssistantConfiguration: (status?: string) => void;
  availability: () => AssistantAvailabilityResult;
  refreshHealth: () => Promise<void>;
  resetEventStatuses: () => void;
  setEventStatus: (key: string, value: string, tone?: CodexStatusTone) => void;

  loadThreadList: (options?: { append?: boolean }) => Promise<boolean>;
  loadWorkspace: () => Promise<void>;
  loadConversation: (threadId: string) => Promise<boolean>;
  createThread: () => Promise<void>;
  deleteConversation: (threadId: string) => Promise<void>;
  useEmptyThread: (threadId: string) => void;

  setContext: (context: Record<string, unknown>) => void;
  clearContext: () => void;
  rememberTask: (task: Record<string, unknown>) => LocalTask;
  selectTask: (task: LocalTask | null) => void;
  appendMessage: (record: MessageRecord) => void;
  updateMessage: (id: string, patch: Partial<MessageRecord>) => void;

  ask: (message: string, jobId?: string) => Promise<void>;
  stop: () => Promise<void>;
  persist: () => void;
}

const stored = loadStoredConversation();

export const useAssistantStore = create<AssistantState>((set, get) => ({
  messages: stored.messages,
  tasks: stored.tasks,
  selectedTaskId: stored.tasks.length ? stored.tasks[stored.tasks.length - 1].local_task_id : null,

  codexHealth: null,
  codexEnabled: null,
  codexReady: false,
  assistantConfigurationStatus: undefined,
  healthRequestId: 0,

  threadId: stored.codexThreadId,
  threadMetadata: null,
  conversations: [],
  cursor: "",
  listLoading: false,
  listError: "",
  pendingThreadId: "",
  historyLoading: false,
  historyError: "",
  historyRequestId: 0,

  turnId: "",
  turnReady: null,
  stopRequested: false,
  controller: null,
  eventState: {},

  context: {},
  liveRun: { visible: false, label: "等待 Codex 事件", detail: "等待事件返回" },
  status: { message: "等待提问", kind: "ok" },

  setAssistantConfiguration: (assistantConfigurationStatus) =>
    set({ assistantConfigurationStatus }),

  availability: () => {
    const state = get();
    return computeAvailability(state);
  },

  refreshHealth: async () => {
    const requestId = get().healthRequestId + 1;
    set({ healthRequestId: requestId });
    let health: CodexHealth;
    try {
      health = await api<CodexHealth>("/api/codex/health");
    } catch {
      health = { enabled: false, ready: false, state: "unavailable" };
    }
    if (get().healthRequestId !== requestId) return;
    set({
      codexHealth: health,
      codexEnabled: health?.enabled === true,
      codexReady: health?.enabled === true && health?.ready === true,
    });
    const availability = get().availability();
    if (availability.status === "ready") {
      set({ status: { message: "助理已就绪", kind: "ok" } });
      if (!Object.keys(get().eventState).length) get().resetEventStatuses();
    }
    if (!get().messages.length) get().persist();
  },

  resetEventStatuses: () => {
    const threadId = get().threadId;
    set({
      eventState: {
        thread: { value: threadId || "未绑定", tone: threadId ? "ok" : "warn" },
        turn: { value: "等待", tone: "" },
        item: { value: "等待", tone: "" },
        tool: { value: "未报告", tone: "" },
        progress: { value: "等待", tone: "" },
        error: { value: "无", tone: "" },
      },
    });
  },

  setEventStatus: (key, value, tone = "") =>
    set((state) => ({ eventState: { ...state.eventState, [key]: { value, tone } } })),

  setContext: (context) =>
    set({ context: context && typeof context === "object" ? { ...context } : {} }),
  clearContext: () => set({ context: {} }),

  // ------------------------------------------------------------ 会话列表

  loadThreadList: async ({ append = false } = {}) => {
    const availability = get().availability();
    if (get().codexEnabled !== true || get().codexReady !== true) {
      set({ listError: availability.message });
      return false;
    }
    if (get().listLoading) return false;
    set({ listLoading: true, listError: "" });
    try {
      const cursor = append ? get().cursor : "";
      const path = cursor
        ? `/api/codex/threads?limit=20&cursor=${encodeURIComponent(cursor)}`
        : "/api/codex/threads?limit=20";
      const response = await api<Record<string, unknown>>(path);
      const page = Array.isArray(response?.data)
        ? (response.data as CodexThread[])
        : Array.isArray(response?.items)
          ? (response.items as CodexThread[])
          : Array.isArray(response?.threads)
            ? (response.threads as CodexThread[])
            : [];
      const nextCursor = pick(response?.cursor, response?.next_cursor);
      set((state) => ({
        conversations: append ? [...state.conversations, ...page] : page,
        cursor: nextCursor,
        listLoading: false,
      }));
      return true;
    } catch (error) {
      set({ listLoading: false, listError: (error as Error).message });
      return false;
    }
  },

  useEmptyThread: (threadId) => {
    set({
      threadId,
      threadMetadata: { id: threadId, turns: [] },
      messages: [],
      tasks: [],
      selectedTaskId: null,
      context: {},
      pendingThreadId: "",
    });
    writeStorage(STORAGE_KEYS.codexThread, threadId);
    get().resetEventStatuses();
    get().persist();
    set({ status: { message: "已恢复空会话", kind: "ok" } });
  },

  /**
   * 上游 loadConversation：先读 thread（带 turns），空则退化；
   * 有 turns 时再 resume 一次让 App Server 装载会话。
   */
  loadConversation: async (selectedThreadId) => {
    const requestId = get().historyRequestId + 1;
    set({
      historyRequestId: requestId,
      historyLoading: true,
      historyError: "",
      pendingThreadId: selectedThreadId,
    });
    set({ status: { message: "正在恢复 Codex 会话", kind: "warn" } });
    try {
      const detailResponse = await api<unknown>(
        `/api/codex/threads/${encodeURIComponent(selectedThreadId)}`,
      );
      if (requestId !== get().historyRequestId) return false;
      const detailThread = codexThreadPayload(detailResponse);
      if (!Array.isArray(detailThread.turns) || !detailThread.turns.length) {
        get().useEmptyThread(selectedThreadId);
        return true;
      }
      const resumeResponse = await api<unknown>(
        `/api/codex/threads/${encodeURIComponent(selectedThreadId)}/resume`,
        {
          method: "POST",
          headers: authHeaders("恢复会话", { "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        },
      );
      if (requestId !== get().historyRequestId) return false;
      const resumedThread = codexThreadPayload(resumeResponse);
      const historyThread =
        !Array.isArray(detailThread.turns) && Array.isArray(resumedThread.turns)
          ? resumedThread
          : detailThread;
      const messages = codexHistoryMessages(historyThread, selectedThreadId);
      set({
        threadId: selectedThreadId,
        threadMetadata: historyThread,
        messages,
        tasks: [],
        selectedTaskId: null,
        context: {},
        historyError: "",
        historyLoading: false,
        pendingThreadId: "",
      });
      writeStorage(STORAGE_KEYS.codexThread, selectedThreadId);
      get().resetEventStatuses();
      get().persist();
      set({
        status: {
          message: messages.length ? "已恢复 Codex 会话" : "已恢复空会话",
          kind: "ok",
        },
      });
      return true;
    } catch (error) {
      if (requestId !== get().historyRequestId) return false;
      const message = (error as Error).message;
      if (/not materialized|includeTurns is unavailable/i.test(message)) {
        get().useEmptyThread(selectedThreadId);
        return true;
      }
      set({ historyError: message, historyLoading: false, pendingThreadId: "" });
      set({ status: { message: `会话恢复失败：${message}`, kind: "error" } });
      showToast(`会话读取失败：${message}`, "error");
      return false;
    }
  },

  loadWorkspace: async () => {
    await get().refreshHealth();
    const availability = get().availability();
    if (availability.status !== "ready") {
      get().persist();
      return;
    }
    const ok = await get().loadThreadList();
    if (!ok) return;
    const currentThreadId = get().threadId;
    const firstThreadId = get().conversations.length
      ? codexThreadIdOf(get().conversations[0])
      : "";
    const targetThreadId = currentThreadId || firstThreadId;
    const targetThread = get().conversations.find(
      (thread) => codexThreadIdOf(thread) === targetThreadId,
    );
    const targetTurnCount = targetThread?.turn_count ?? targetThread?.turnCount;
    if (targetThreadId && Number(targetTurnCount) === 0) {
      get().useEmptyThread(targetThreadId);
    } else if (targetThreadId) {
      const loaded = await get().loadConversation(targetThreadId);
      if (!loaded && firstThreadId && firstThreadId !== targetThreadId) {
        await get().loadConversation(firstThreadId);
      }
    } else {
      set({ messages: [], tasks: [], selectedTaskId: null, context: {} });
      get().persist();
    }
  },

  createThread: async () => {
    const thread = codexThreadPayload(
      await api<unknown>("/api/codex/threads", {
        method: "POST",
        headers: authHeaders("新建会话", { "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      }),
    );
    const id = codexThreadIdOf(thread);
    set({ threadId: id, threadMetadata: thread, messages: [], tasks: [], selectedTaskId: null });
    writeStorage(STORAGE_KEYS.codexThread, id);
    get().resetEventStatuses();
    get().persist();
  },

  deleteConversation: async (threadId) => {
    try {
      await api(`/api/codex/threads/${encodeURIComponent(threadId)}`, {
        method: "DELETE",
        headers: authHeaders("删除会话"),
      });
      set((state) => ({
        conversations: state.conversations.filter(
          (thread) => codexThreadIdOf(thread) !== threadId,
        ),
      }));
      if (get().threadId === threadId) {
        set({ threadId: "", messages: [], tasks: [], selectedTaskId: null });
        writeStorage(STORAGE_KEYS.codexThread, "");
        get().persist();
      }
      showToast("会话已删除", "success");
    } catch (error) {
      showToast((error as Error).message, "error");
    }
  },

  // ------------------------------------------------------------ 任务与消息

  rememberTask: (task) => {
    const remembered: LocalTask = {
      ...task,
      task_type: text(task.task_type, "conversation"),
      status: text(task.status, "succeeded"),
      local_task_id: text(task.local_task_id, "") || newId("task"),
    };
    set((state) => {
      const tasks = [...state.tasks, remembered].slice(-PERSIST_TASK_LIMIT);
      return { tasks, selectedTaskId: remembered.local_task_id };
    });
    setNavCounts({ tasks: get().tasks.length });
    get().persist();
    return remembered;
  },

  selectTask: (task) => set({ selectedTaskId: task?.local_task_id ?? null }),

  appendMessage: (record) =>
    set((state) => ({ messages: [...state.messages, record] })),

  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((record) =>
        record.id === id ? { ...record, ...patch } : record,
      ),
    })),

  persist: () => {
    const { threadId, messages, tasks } = get();
    if (threadId) writeStorage(STORAGE_KEYS.codexThread, threadId);
    writeStorage(
      STORAGE_KEYS.recent,
      JSON.stringify({
        version: 1,
        codexThreadId: threadId || null,
        messages: redactStorageValue(messages.slice(-PERSIST_MESSAGE_LIMIT)),
        tasks: redactStorageValue(tasks.slice(-PERSIST_TASK_LIMIT)),
      }),
    );
  },

  // ------------------------------------------------------------ 发问 + 流

  ask: async (message, jobId = "") => {
    const normalized = text(message, "").trim();
    if (!normalized) return;
    const availability = get().availability();
    if (availability.status !== "ready") {
      showToast(availability.message, "error");
      return;
    }
    if (!get().threadId) await get().createThread();

    const controller = new AbortController();
    let resolveTurnReady: ((value: string) => void) | null = null;
    set({
      controller,
      stopRequested: false,
      turnId: "",
      turnReady: new Promise((resolve) => {
        resolveTurnReady = resolve;
      }),
      liveRun: { visible: true, label: "等待 Codex 事件", detail: "正在发起回合" },
    });

    const userRecord: MessageRecord = {
      id: newId("user"),
      role: "user",
      body: normalized,
      created_at: new Date().toISOString(),
    };
    const answerRecordId = newId("assistant");
    get().appendMessage(userRecord);
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: answerRecordId,
          role: "assistant",
          body: "",
          created_at: new Date().toISOString(),
          streaming: true,
        },
      ],
    }));

    get().resetEventStatuses();
    get().setEventStatus("thread", get().threadId, "ok");
    get().setEventStatus("error", "无", "");

    const threadId = get().threadId;
    const streamPath = `/api/codex/threads/${encodeURIComponent(threadId)}/turns/stream`;
    const eventPath = `/api/codex/threads/${encodeURIComponent(threadId)}/events`;
    const body = jobId
      ? JSON.stringify({ text: normalized, job_id: jobId })
      : JSON.stringify({ text: normalized });

    const cleanup = () => {
      resolveTurnReady?.(get().turnId || "");
      set({ turnReady: null, controller: null });
    };
    const isCancelled = () =>
      controller.signal.aborted || get().stopRequested;
    const cancelledError = () => {
      const error = new Error("Codex 执行已取消。");
      error.name = "AbortError";
      return error;
    };

    let streamedAnswer = "";
    let streamError: string | null = null;
    let turnCompleted = false;
    let activeTurnId = "";
    const stages: Array<{ event_type: string; label: string }> = [];
    const dedupe = createDedupe();

    /** 单帧处理：与上游 handleEvent 的事件种类一致。 */
    const handleEvent = (eventName: string, payload: unknown) => {
      if (isCancelled() || turnCompleted) return;
      const event = (payload ?? {}) as Record<string, unknown>;
      const data = (event.payload ?? {}) as Record<string, unknown>;
      const kind = text(event.event_type, eventName).toLowerCase();
      const turnId = pick(
        event.turn_id,
        event.turnId,
        data.turn_id,
        data.turnId,
        kind === "turn" ? event.id : "",
      );
      if (activeTurnId && turnId && turnId !== activeTurnId) return;
      if (turnId && !activeTurnId) activeTurnId = turnId;
      if (dedupe.shouldSkip(eventName, { event_type: kind, ...event })) return;

      const detail = eventDetail(event, data);
      switch (kind) {
        case "thread_started":
          get().setEventStatus("thread", pick(event.thread_id, data.thread_id) || threadId, "ok");
          break;
        case "turn_started":
          set({ turnId: turnId });
          get().setEventStatus("turn", turnId || "已开始", "ok");
          break;
        case "item_started":
          get().setEventStatus("item", detail, "active");
          break;
        case "item_completed":
          get().setEventStatus("item", detail, "ok");
          break;
        case "text_delta": {
          const delta = codexContentText(
            (event.text ?? data.text ?? data.delta) as CodexContent,
          );
          if (delta) {
            streamedAnswer += delta;
            get().updateMessage(answerRecordId, { body: streamedAnswer, streaming: true });
          }
          break;
        }
        case "tool_started":
        case "tool_call":
          get().setEventStatus("tool", pick(event.method, data.tool_name, detail), "active");
          break;
        case "tool_completed":
          get().setEventStatus(
            "tool",
            `${pick(event.method, data.tool_name, detail)} · ${text(data.status, "已返回")}`,
            "ok",
          );
          break;
        case "progress":
          get().setEventStatus("progress", detail, "active");
          set({ liveRun: { visible: true, label: detail, detail: friendlyRuntimeError(detail) } });
          break;
        case "thread_updated":
          set({ threadMetadata: { ...get().threadMetadata, ...(data as CodexThread) } });
          break;
        case "error":
          streamError = friendlyRuntimeError(detail);
          get().setEventStatus("error", streamError, "error");
          break;
        case "turn_completed":
          turnCompleted = true;
          get().setEventStatus("turn", "已完成", "ok");
          get().setEventStatus("progress", "已完成", "");
          break;
        default:
          break;
      }
      if (kind !== "text_delta" && detail) {
        const previous = stages[stages.length - 1];
        if (!previous || previous.event_type !== kind || previous.label !== detail) {
          stages.push({ event_type: kind, label: detail });
        }
      }
    };

    const consumeBlock = (block: string) => {
      const frame = parseSseBlock(block);
      if (!frame) return;
      handleEvent(frame.event, frame.data);
    };

    const consumeResponse = async (response: Response) => {
      if (!response.ok || !response.body?.getReader) {
        let message = `Codex 流连接失败（${response.status}）`;
        try {
          const payload = (await response.json()) as { detail?: string };
          message = payload?.detail || message;
        } catch {
          /* 流错误体未必是 JSON，保留默认文案 */
        }
        throw new Error(message);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        blocks.forEach(consumeBlock);
        if (turnCompleted || isCancelled()) {
          if (turnCompleted && typeof reader.cancel === "function") {
            try {
              await reader.cancel();
            } catch {
              /* 服务端可能已经先关闭 */
            }
          }
          break;
        }
        if (done) break;
      }
      if (buffer.trim()) consumeBlock(buffer);
      if (isCancelled()) throw cancelledError();
    };

    try {
      let response: Response;
      try {
        response = await fetch(streamPath, {
          method: "POST",
          headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
          signal: controller.signal,
          body,
        });
      } catch (error) {
        cleanup();
        throw error;
      }
      if (!response.ok || !response.body) {
        let message = `Codex 请求失败（${response.status}）`;
        try {
          const payload = (await response.json()) as { detail?: string };
          message = payload?.detail || message;
        } catch {
          /* 非 JSON 错误体 */
        }
        get().setEventStatus("error", message, "error");
        cleanup();
        throw new Error(message);
      }

      let reconnectAttempts = 0;
      for (;;) {
        try {
          await consumeResponse(response);
          if (turnCompleted) break;
          if (isCancelled()) throw cancelledError();
          throw new Error("Codex 流连接已断开。");
        } catch (error) {
          if ((error as Error).name === "AbortError" || isCancelled()) throw cancelledError();
          if (streamError) throw new Error(streamError);
          if (reconnectAttempts >= CODEX_STREAM_MAX_RECONNECTS) throw error;
          reconnectAttempts += 1;
          dedupe.armReplayFence();
          const label = `Codex 连接中断，正在重连（${reconnectAttempts}/${CODEX_STREAM_MAX_RECONNECTS}）`;
          set({
            status: { message: label, kind: "warn" },
            liveRun: { visible: true, label: "Codex 流连接中断", detail: label },
          });
          get().setEventStatus("progress", label, "active");
          response = await fetch(eventPath, {
            method: "GET",
            headers: {
              Accept: "text/event-stream",
              ...(dedupe.lastEventId ? { "Last-Event-ID": dedupe.lastEventId } : {}),
            },
            signal: controller.signal,
          });
        }
      }
      if (streamError) throw new Error(streamError);
      if (!turnCompleted) throw new Error("Codex 流已结束，但没有收到 turn_completed 事件。");

      get().updateMessage(answerRecordId, {
        body: streamedAnswer || "Codex 未返回文本。",
        streaming: false,
      });
      const task = get().rememberTask({
        task_id: `codex-${get().turnId || Date.now()}`,
        task_type: "conversation",
        user_request: normalized,
        status: "succeeded",
        steps: stages.length,
        answer: streamedAnswer || "Codex 未返回文本。",
        error: null,
        thread_id: get().threadId,
        turn_id: get().turnId,
        stages,
        codex_events: stages,
        job_id: jobId,
      });
      get().updateMessage(answerRecordId, { task_id: task.local_task_id, result: task });
      set({ liveRun: { visible: false, label: "", detail: "" } });
      set({ status: { message: "已完成", kind: "ok" } });
    } catch (error) {
      const aborted = (error as Error).name === "AbortError";
      const message = (error as Error).message;
      get().updateMessage(answerRecordId, {
        body: streamedAnswer || (aborted ? "执行已取消。" : message),
        streaming: false,
      });
      get().rememberTask({
        task_id: `codex-${get().turnId || Date.now()}`,
        task_type: "conversation",
        user_request: normalized,
        status: aborted ? "stopped" : "failed",
        steps: stages.length,
        error: message,
        thread_id: get().threadId,
        turn_id: get().turnId,
        stages,
      });
      set({ liveRun: { visible: false, label: "", detail: "" } });
      set({ status: { message: aborted ? "已停止" : message, kind: "error" } });
      if (!aborted) showToast(message, "error");
    } finally {
      cleanup();
      get().persist();
    }
  },

  stop: async () => {
    set({ stopRequested: true });
    get().setEventStatus("progress", "正在停止", "warn");
    const threadId = get().threadId;
    if (threadId) {
      try {
        await api(`/api/codex/threads/${encodeURIComponent(threadId)}/interrupt`, {
          method: "POST",
          headers: authHeaders("中断回合", { "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        });
      } catch {
        /* 中断失败也要继续本地 abort，否则按钮卡在运行中 */
      }
    }
    get().controller?.abort();
  },
}));

/**
 * 上游 codexHistoryMessages：把 thread.turns 摊平成消息记录，
 * 只保留有文本的条目，并按 turn 生成一条本地任务。
 */
function codexHistoryMessages(thread: CodexThread, threadId: string): MessageRecord[] {
  const records: MessageRecord[] = [];
  const add = (
    role: "user" | "assistant",
    body: CodexContent,
    timestamp: unknown,
    extra: Partial<MessageRecord> = {},
  ) => {
    const normalized = codexContentText(body).trim();
    if (!normalized) return;
    records.push({
      id: `codex-${role}-${records.length}`,
      role,
      body: normalized,
      created_at: timestamp ? new Date(String(timestamp)).toISOString() : undefined,
      ...extra,
    });
  };
  const turns = Array.isArray(thread.turns) ? thread.turns : [];
  turns.forEach((turn, turnIndex) => {
    const items = Array.isArray(turn.items) ? turn.items : [];
    items.forEach((item) => {
      const role = text(item.role, "").toLowerCase();
      const type = text(item.type ?? item.item_type, "").toLowerCase();
      if (role === "user" || type === "user_message") {
        add("user", (item.text ?? item.content ?? item.body) as CodexContent, turn.created_at);
      } else if (role === "assistant" || type === "agent_message") {
        add(
          "assistant",
          (item.text ?? item.content ?? item.body) as CodexContent,
          turn.created_at,
          { task_id: `codex-turn-${turnIndex}` },
        );
      }
    });
  });
  void threadId;
  return records;
}

/** 上游 mapIntent：命中第一条关键词规则，否则退回 today_new_jobs。 */
export function mapIntent(message: string): {
  taskType: string;
  label: string;
  matched: boolean;
} {
  const normalized = text(message, "").trim().toLowerCase();
  const match = INTENT_RULES.find((rule) =>
    rule.terms.some((term) => normalized.includes(term)),
  );
  if (match) return { taskType: match.taskType, label: match.label, matched: true };
  return { taskType: "today_new_jobs", label: TASK_LABELS.today_new_jobs, matched: false };
}
