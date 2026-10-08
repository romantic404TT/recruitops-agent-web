/**
 * 日期、分数、标签等纯函数，逐条对照上游 app.js 的同名实现。
 * 组件里不重复写格式化逻辑，保证「地点待确认」「日期待定」这类兜底串全站一致。
 */
import {
  APPLICATION_STAGE_LABELS,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_TIME_KIND_LABELS,
  SAFE_LINK_PROTOCOLS,
} from "./labels";
import type { ApplicationStage, ScheduleEvent } from "@/types/domain";
import type { CodexContent, CodexThread } from "@/types/codex";

export const text = (value: unknown, fallback: string | number = "—"): string =>
  String(value ?? fallback);

/** app.js:103 —— 用本地时区而非 toISOString，避免跨零点日期偏移。 */
export function localDate(value: Date = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export const today = localDate();

/** app.js —— MM/DD 短日期。 */
export function compactDate(value: unknown, fallback = "—"): string {
  if (!value) return fallback;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

export function mailDateTime(value: unknown, fallback = "时间待确认"): string {
  if (!value) return fallback;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function automationDateTime(value: unknown, fallback = "尚未执行"): string {
  if (!value) return fallback;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 上游 batchLabel */
export function batchLabel(batch: string | null | undefined): string {
  const map: Record<string, string> = { formal: "正式批", early: "提前批" };
  return (batch && map[batch]) || text(batch, "批次待确认");
}

export function applicationStageLabel(stage: unknown): string {
  return (
    APPLICATION_STAGE_LABELS[stage as ApplicationStage] ?? text(stage, "阶段待确认")
  );
}

/** analysis_status 在这几个值里的岗位不进列表（app.js visibleJobs）。 */
const EXCLUDED_ANALYSIS_STATUSES = new Set([
  "excluded",
  "direction_out",
  "doctorate_only",
  "internship",
  "cohort_unconfirmed",
]);

export function visibleJobs<T extends { analysis_status?: string | null }>(
  items: T[] | null | undefined,
): T[] {
  return Array.isArray(items)
    ? items.filter((job) => job && !EXCLUDED_ANALYSIS_STATUSES.has(job.analysis_status ?? ""))
    : [];
}

/** scoreBadge 的语义：状态不是 complete 时分数一律不显示，改显示状态文案。 */
export const UNSCORED_LABELS: Record<string, string> = {
  eligible: "待评分",
  jd_incomplete: "待补全 JD",
  direction_out: "方向不符",
  doctorate_only: "博士限定",
  internship: "实习岗位",
  cohort_unconfirmed: "届别待核查",
  master_only: "硕士限定",
  not_target_track: "非目标批次",
  failed: "评分失败",
  refused: "未能评分",
};

export interface ScoreBadgeModel {
  label: string;
  /** high | medium | low | empty */
  tone: "high" | "medium" | "low" | "empty";
}

export function scoreBadgeModel(
  score: number | null | undefined,
  status: string | null = null,
): ScoreBadgeModel {
  const effective = status && status !== "complete" ? null : score;
  if (effective == null) {
    return { label: UNSCORED_LABELS[status ?? ""] || "未评分", tone: "empty" };
  }
  const tone = effective >= 80 ? "high" : effective >= 60 ? "medium" : "low";
  return { label: String(effective), tone };
}

// ---------------------------------------------------------------- 日程

export function normalizeScheduleStatus(value: unknown): string {
  const key = String(value ?? "");
  return Object.prototype.hasOwnProperty.call(SCHEDULE_STATUS_LABELS, key)
    ? key
    : "pending";
}

export function normalizeScheduleTimeKind(value: unknown): string {
  const key = String(value ?? "");
  return Object.prototype.hasOwnProperty.call(SCHEDULE_TIME_KIND_LABELS, key)
    ? key
    : "appointment";
}

/** 只接受严格 YYYY-MM-DD，且校验回读一致（拒绝 2026-02-31 这类溢出日期）。 */
export function parseScheduleDate(value: unknown): Date | null {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return parsed.getFullYear() === Number(match[1]) &&
    parsed.getMonth() === Number(match[2]) - 1 &&
    parsed.getDate() === Number(match[3])
    ? parsed
    : null;
}

export function scheduleDateKey(value: Date | string | null | undefined): string {
  const parsed = value instanceof Date ? value : parseScheduleDate(value);
  if (!parsed) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function scheduleMonthKey(value: Date | string | null | undefined): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const match = String(value ?? today).match(/^(\d{4})-(\d{2})/);
  if (!match) return today.slice(0, 7);
  return `${match[1]}-${match[2]}`;
}

export function scheduleMonthStart(value?: Date | string | null): Date {
  const [year, month] = scheduleMonthKey(value ?? today).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function addScheduleDays(value: string, amount: number): string {
  const parsed = parseScheduleDate(value) ?? new Date();
  parsed.setDate(parsed.getDate() + amount);
  return scheduleDateKey(parsed);
}

export function scheduleDateLabel(value: unknown, fallback = "日期待定"): string {
  const parsed = parseScheduleDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function scheduleEventTitle(event: Partial<ScheduleEvent> = {}): string {
  return text(
    event.title || [event.company_name, event.event_type].filter(Boolean).join(" · "),
    "未命名事项",
  );
}

export function scheduleTimeLabel(event: Partial<ScheduleEvent> = {}): string {
  if (event.event_time) return text(event.event_time, "").slice(0, 5);
  if (!event.event_date) return "时间待定";
  if (normalizeScheduleTimeKind(event.time_kind) === "deadline") return "截止提醒";
  return "时间待定";
}

export function scheduleCalendarTimeLabel(event: Partial<ScheduleEvent> = {}): string {
  const eventTime = event.event_time ? text(event.event_time, "").slice(0, 5) : "";
  if (normalizeScheduleTimeKind(event.time_kind) === "deadline") {
    return eventTime ? `截止 ${eventTime}` : "截止";
  }
  return eventTime || "未定时段";
}

export function scheduleTimeSeconds(value: unknown): number | null {
  const match = text(value, "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

/** 逾期 / 即将到期（7 天内）/ 其他。非 pending 一律进「其他」。 */
export type ScheduleDueGroup = "overdue" | "soon" | "other";

export function scheduleDueGroup(
  event: Partial<ScheduleEvent> = {},
  now: Date = new Date(),
): ScheduleDueGroup {
  const eventDate = event.event_date;
  if (normalizeScheduleStatus(event.status) !== "pending" || !eventDate) return "other";
  const currentDate = localDate(now);
  if (eventDate < currentDate) return "overdue";
  if (eventDate === currentDate && event.event_time) {
    const eventSeconds = scheduleTimeSeconds(event.event_time);
    const currentSeconds =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    if (eventSeconds !== null && eventSeconds < currentSeconds) return "overdue";
  }
  if (eventDate <= addScheduleDays(currentDate, 7)) return "soon";
  return "other";
}

/** 上游排 3 组时的组内次序键：无日期/无时间的沉底，再按 id 稳定。 */
export function scheduleSortValue(event: Partial<ScheduleEvent> = {}): string {
  return `${event.event_date || "9999-99-99"}T${event.event_time || "99:99:99"}T${text(event.id, "")}`;
}

/** 上游 automationDuration：只在首尾时间都存在时才算，且不小于 0。 */
export function automationDuration(
  startedAt: unknown,
  completedAt: unknown,
): string {
  if (!startedAt || !completedAt) return "—";
  const started = new Date(startedAt as string);
  const completed = new Date(completedAt as string);
  const seconds = Math.max(0, Math.round((completed.getTime() - started.getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`;
}

/** app.js safeScheduleHref —— 日程里的位置字段只有确实是 http(s) 才渲染成链接。 */
export function safeScheduleHref(value: unknown): string | null {
  const candidate = text(value, "").trim();
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** app.js:249 SAFE_LINK_PROTOCOLS 的实际使用点：富文本里的 a[href] 过滤。 */
export function isSafeLink(rawHref: string): boolean {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(rawHref, window.location.origin).protocol);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- 其它

export const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return text(value);
  }
}

/** 投递卡头像：公司名洗掉行政区划后缀取前两字，再按字符码求和分 5 个色调。 */
export function applicationAvatar(companyName: string): { label: string; tone: number } {
  const cleaned =
    companyName
      .replace(/^加入/, "")
      .replace(/^(深圳市|北京市|上海市|杭州市)/, "")
      .replace(/(科技|集团|股份|有限|公司).*$/, "") || companyName;
  const tone =
    Array.from(companyName).reduce((total, char) => total + char.charCodeAt(0), 0) % 5;
  return { label: cleaned.slice(0, 2), tone };
}

// ---------------------------------------------------------------- Codex

/** app.js codexThreadIdOf —— 上游字段命名不统一，这里三种都试。 */
export function codexThreadIdOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const record = value as { id?: unknown; thread_id?: unknown; threadId?: unknown };
  return text(record?.id ?? record?.thread_id ?? record?.threadId, "").trim();
}

export function codexThreadPayload(response: unknown): CodexThread {
  const wrapped = (response as { thread?: CodexThread })?.thread;
  if (wrapped && typeof wrapped === "object") return wrapped;
  return response && typeof response === "object" ? (response as CodexThread) : {};
}

export function codexThreadTitle(thread?: CodexThread | null): string {
  return text(thread?.preview ?? thread?.name ?? thread?.title, "新 Codex 会话");
}

export function codexTimestamp(value: unknown): string {
  if (value === null || value === undefined || value === "") return new Date().toISOString();
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const date = new Date(numeric < 1e12 ? numeric * 1000 : numeric);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function codexThreadUpdatedAt(thread?: CodexThread | null): string {
  const value =
    thread?.updatedAt ?? thread?.updated_at ?? thread?.recencyAt ?? thread?.recency_at;
  if (value === null || value === undefined || value === "") return "刚刚";
  return new Date(codexTimestamp(value)).toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Codex 正文可能是字符串、块数组、或 {text|content|value} 任意嵌套。 */
export function codexContentText(value: CodexContent): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        return codexContentText(
          (part.text ?? part.content ?? part.value) as CodexContent,
        );
      })
      .filter(Boolean)
      .join("");
  }
  if (value && typeof value === "object") {
    return codexContentText((value.text ?? value.content ?? value.value) as CodexContent);
  }
  return "";
}
