/**
 * Codex 运行时相关类型（求职助理）。
 * 上游 `/api/codex/*` 直接透传 Codex App Server 的 JSON-RPC 对象，
 * 因此字段命名混用 camelCase / snake_case —— 前端两种都读（app.js:3229+ 的
 * codexThreadIdOf / codexThreadTitle / codexThreadUpdatedAt 就是为此存在）。
 * 这里如实保留这种不确定性，而不是假装只有一种写法。
 */

export interface CodexHealth {
  enabled: boolean;
  ready?: boolean;
  state?: string;
  detail?: string;
  context_management?: {
    context_window_tokens: number;
    auto_compact_token_limit: number;
  };
  [key: string]: unknown;
}

/** 内容块：Codex 的 body 可能是字符串、块数组、或 {text|content|value} 嵌套。 */
export type CodexContent =
  | string
  | CodexContentPart[]
  | CodexContentPart
  | null
  | undefined;

export interface CodexContentPart {
  text?: string;
  content?: CodexContent;
  value?: CodexContent;
  type?: string;
  [key: string]: unknown;
}

export interface CodexItem {
  id?: string;
  type?: string;
  role?: string;
  text?: CodexContent;
  content?: CodexContent;
  body?: CodexContent;
  toolName?: string;
  tool_name?: string;
  arguments?: Record<string, unknown>;
  output?: CodexContent;
  [key: string]: unknown;
}

export interface CodexTurn {
  id?: string;
  turn_id?: string;
  turnId?: string;
  status?: string;
  items?: CodexItem[];
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CodexThread {
  id?: string;
  thread_id?: string;
  threadId?: string;
  name?: string;
  title?: string;
  preview?: string;
  turns?: CodexTurn[];
  turn_count?: number;
  turnCount?: number;
  cursor?: string;
  updated_at?: string | number;
  updatedAt?: string | number;
  recency_at?: string | number;
  recencyAt?: string | number;
  [key: string]: unknown;
}

/** GET /api/codex/threads —— 带分页游标。 */
export interface CodexThreadPage {
  data?: CodexThread[];
  items?: CodexThread[];
  threads?: CodexThread[];
  cursor?: string | null;
  next_cursor?: string | null;
  [key: string]: unknown;
}

/** GET /api/codex/traces 的行：前端用 event_type|kind、method|name 兜底。 */
export interface CodexTrace {
  event_type?: string;
  kind?: string;
  method?: string;
  name?: string;
  success?: boolean;
  latency_ms?: number;
  elapsed_ms?: number;
  error_code?: string;
  phase?: string;
  thread_id?: string;
  metadata?: { read_only?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

/** SSE `POST /turns/stream` 与 `GET /events` 的事件帧。 */
export interface CodexStreamEvent {
  event?: string;
  type?: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface CodexEventState {
  thread?: string;
  turn?: string;
  item?: string;
  tool?: string;
  progress?: string;
  error?: string;
}
