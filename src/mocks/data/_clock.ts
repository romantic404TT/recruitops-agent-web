/**
 * mock 数据的时间工具。
 *
 * 为什么 fixture 用 TS 工厂而不是静态 JSON：上游大量接口按「今天」过滤
 * （`/api/jobs/browse?first_seen_on=<today>`、`/api/schedule?on=<today>`、
 * 首页 4 个 metric、待办的逾期/即将到期分组）。写死日期的 JSON 会在生成的第二天
 * 让整个首页和「今日」档全空，看起来像应用坏了。所以日期一律相对运行时计算。
 */

export const pad = (part: number) => String(part).padStart(2, "0");

export function dateKey(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export const today = (): string => dateKey(new Date());

export function daysFromNow(offset: number, base = new Date()): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + offset);
  return next;
}

export function dateOffsetKey(offset: number): string {
  return dateKey(daysFromNow(offset));
}

/** ISO 时间戳，支持相对天数与固定时分秒。 */
export function isoAt(dayOffset: number, hour = 9, minute = 0): string {
  const value = daysFromNow(dayOffset);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

/** 上游 Job.first_seen_at 判定「今日新增」用的是本地日期，这里对齐。 */
export function firstSeenToday(hour = 8, minute = 30): string {
  return isoAt(0, hour, minute);
}

let counter = 100;
/** 稳定自增 id：新建记录要有 id，且同一进程内不重复。 */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export const audit = (createdDayOffset = -3) => ({
  created_at: isoAt(createdDayOffset, 9, 0),
  updated_at: isoAt(createdDayOffset, 9, 0),
  source: "recruitops-mock",
  source_ref: null as string | null,
});
