/**
 * SSE 消费层。上游不用 EventSource（因为要 POST body），
 * 而是手写 `fetch` + `response.body.getReader()` 分帧（app.js:3826-3846）。
 * 这里把分帧、去重、字段兜底抽成纯函数，方便单测。
 */
import { safeJson, text } from "./format";

export interface SseFrame {
  event: string;
  data: unknown;
  id: string;
}

/** 按空行切帧；返回尚未成帧的尾巴继续留在 buffer 里。 */
export function splitSseBuffer(buffer: string): { frames: SseFrame[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  return { frames: blocks.map(parseSseBlock).filter(Boolean) as SseFrame[], rest };
}

export function parseSseBlock(block: string): SseFrame | null {
  let event = "message";
  let id = "";
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
    else if (field === "id") id = value;
  }
  if (!dataLines.length && !event) return null;
  const raw = dataLines.join("\n");
  let data: unknown = raw;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  return { event, data, id };
}

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** 上游 pick：取第一个非空字符串。 */
export function pick(...values: unknown[]): string {
  const hit = values.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return hit ? (hit as string).trim() : "";
}

/** eventIdOf 在 8 个候选位置里找（上游字段命名不统一）。 */
export function eventIdOf(frame: SseFrame): string {
  const event = frame as unknown as Record<string, unknown>;
  const data = objectValue(objectValue(event.payload).payload ?? event.data);
  const candidates: unknown[] = [
    event.event_id,
    event.eventId,
    data.event_id,
    data.eventId,
    event.sequence,
    event.seq,
    data.sequence,
    data.seq,
  ];
  const value = candidates.find(
    (candidate) =>
      (typeof candidate === "string" && candidate.trim()) || Number.isFinite(candidate),
  );
  return value === undefined || value === null ? "" : String(value);
}

export function eventFingerprintOf(eventName: string, event: unknown): string {
  const node = objectValue(event);
  return safeJson({
    eventName,
    event_type: node.event_type,
    method: node.method,
    thread_id: node.thread_id,
    turn_id: node.turn_id,
    item_id: node.item_id,
    text: node.text,
    payload: node.payload,
  });
}

/**
 * 重连后服务端可能重发最后一帧，上游用「有 id 按 id 去重、无 id 按指纹栅栏」两套规则
 * （app.js:3661）。这里原样实现。
 */
export function createDedupe() {
  const seen = new Set<string>();
  let lastEventId = "";
  let lastFingerprint = "";
  let replayFence = false;

  return {
    get lastEventId() {
      return lastEventId;
    },
    armReplayFence() {
      replayFence = true;
    },
    shouldSkip(eventName: string, frame: unknown): boolean {
      const id = eventIdOf(frame as SseFrame);
      if (id) {
        const key = `id:${id}`;
        if (seen.has(key)) return true;
        seen.add(key);
        lastEventId = id;
        return false;
      }
      const fingerprint = eventFingerprintOf(eventName, frame);
      if (replayFence && fingerprint === lastFingerprint) {
        replayFence = false;
        return true;
      }
      replayFence = false;
      lastFingerprint = fingerprint;
      return false;
    },
  };
}

/** eventDetail：把一帧里所有可能携带文案的字段按优先级挑一个出来。 */
export function eventDetail(payload: unknown, data: unknown, fallback = "状态已更新"): string {
  const node = objectValue(payload);
  const inner = objectValue(data);
  const innerError = objectValue(inner.error);
  const nodeError = objectValue(node.error);
  return (
    pick(
      node.text,
      node.message,
      inner.message,
      typeof inner.error === "string" ? inner.error : "",
      innerError.message,
      innerError.detail,
      nodeError.message,
      nodeError.detail,
      inner.detail,
      inner.status,
      inner.phase,
    ) || fallback
  );
}

/** 上游 friendlyRuntimeError：402 余额不足单独翻译成可操作的中文。 */
export function friendlyRuntimeError(value: unknown): string {
  const raw = text(value, "模型运行时返回了未说明的错误。");
  if (/\b402\b.*insufficient balance|insufficient balance.*\b402\b/i.test(raw)) {
    return "Agent 专用 DeepSeek API 余额不足，请充值或更换 Key。";
  }
  return raw;
}
