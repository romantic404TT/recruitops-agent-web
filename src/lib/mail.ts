/**
 * 招聘邮件的派生逻辑，对照 app.js:2315-2417。
 * 这些函数决定标签文案与色调，单列出来避免散在组件里。
 */
import {
  MAIL_CATEGORY_LABELS,
  MAIL_FRESHNESS_STATUSES,
  MAIL_PROCESSING_STATUS_LABELS,
} from "@/lib/labels";
import { text } from "./format";
import type { MailFreshness, RecruitmentMail } from "@/types/mail";

export function normalizeMailStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function mailProcessingLabel(status: unknown): string {
  return MAIL_PROCESSING_STATUS_LABELS[normalizeMailStatus(status)] || "待处理";
}

export type MailTone = "success" | "error" | "muted" | "pending";

export function mailProcessingTone(status: unknown): MailTone {
  const normalized = normalizeMailStatus(status);
  if (["processed_updated", "processed_unchanged", "processed", "linked"].includes(normalized)) {
    return "success";
  }
  if (normalized === "failed") return "error";
  if (["irrelevant", "ignored"].includes(normalized)) return "muted";
  return "pending";
}

export interface MailAssociation {
  key: "linked" | "pending" | "muted" | "error" | "review";
  label: string;
}

/** 关联态优先看 application_id，其次才看处理状态（app.js:2332）。 */
export function mailAssociationState(mail?: RecruitmentMail | null): MailAssociation {
  if (mail?.application_id) return { key: "linked", label: "已关联" };
  const processing = normalizeMailStatus(mail?.processing_status);
  if (processing === "pending_association") return { key: "pending", label: "待关联" };
  if (["irrelevant", "ignored"].includes(processing)) return { key: "muted", label: "不适用" };
  if (processing === "failed") return { key: "error", label: "关联失败" };
  if (mail?.requires_confirmation || processing === "needs_confirmation") {
    return { key: "review", label: "待确认" };
  }
  return { key: "pending", label: "待关联" };
}

export function mailCategoryLabel(category: unknown): string {
  return MAIL_CATEGORY_LABELS[String(category ?? "")] || text(category, "其他");
}

/** 置信度：0-1 的小数换算成百分比；不是数字就显示「待确认」。 */
export function mailConfidenceLabel(confidence: unknown): string {
  const numeric = Number(confidence);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : "待确认";
}

export type MailFreshnessState = "synced" | "cached" | "failed" | "disabled" | "unknown";

export function mailFreshnessStatus(
  freshness: MailFreshness | null | undefined,
  unavailable = false,
): MailFreshnessState {
  const status = normalizeMailStatus(freshness?.status);
  if (MAIL_FRESHNESS_STATUSES.has(status)) return status as MailFreshnessState;
  return unavailable ? "disabled" : "unknown";
}

export function mailFreshnessError(freshness: unknown): string {
  const node = (freshness ?? {}) as { error_type?: unknown; error?: unknown; reason?: unknown };
  return text(node.error_type || node.error || node.reason, "同步失败");
}
