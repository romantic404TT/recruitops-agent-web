import type { ApplicationStage, ISODateTime } from "./domain";

/** 招聘邮件分类（前端 MAIL_CATEGORY_LABELS，app.js:2290）。 */
export type MailCategory =
  | "application_confirmation"
  | "assessment"
  | "written_test"
  | "interview"
  | "offer"
  | "rejection"
  | "other";

/** 处理状态（前端 MAIL_PROCESSING_STATUS_LABELS，app.js:2300）。 */
export type MailProcessingStatus =
  | "pending"
  | "processed_updated"
  | "processed_unchanged"
  | "processed"
  | "irrelevant"
  | "pending_association"
  | "failed"
  | "needs_confirmation"
  | "linked"
  | "ignored";

/** GET /api/recruitment-mails 列表项（上游 RecruitmentMailRecord 的前端子集）。 */
export interface RecruitmentMail {
  id: string;
  subject: string;
  sender?: string | null;
  recipients?: string[];
  received_at?: ISODateTime | null;
  category?: MailCategory | string;
  confidence?: number | null;
  processing_status?: MailProcessingStatus | string;
  requires_confirmation?: boolean;
  application_id?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  mailbox?: string;
  message_id?: string;
  body_text?: string;
  company_candidates?: Array<{ value: string; confidence?: number }>;
  job_candidates?: Array<{ value: string; confidence?: number }>;
  [key: string]: unknown;
}

/** 新鲜度：synced | cached | failed | disabled，未知时前端显示为 unknown 并隐藏提示条。 */
export type MailFreshnessStatus = "synced" | "cached" | "failed" | "disabled";

export interface MailFreshness {
  status?: MailFreshnessStatus | string | null;
  synced_at?: ISODateTime | null;
  error_type?: string | null;
  error?: string | null;
  reason?: string | null;
}

/** GET /api/recruitment-mails?limit=50 */
export interface MailListResponse {
  items: RecruitmentMail[];
  total?: number;
  /** true 表示邮箱连接不可用（前端据此显示"尚未连接"）。 */
  unavailable?: boolean;
  freshness?: MailFreshness;
  data?: { freshness?: MailFreshness; sync?: MailSyncCounts };
}

export interface MailSyncCounts {
  fetched?: number;
  inserted?: number;
  reused?: number;
}

/** POST /api/recruitment-mails/sync?limit=100 */
export interface MailSyncResponse {
  status?: string;
  sync?: MailSyncCounts;
  reason?: string;
  error?: string;
  error_type?: string;
  data?: { status?: string; sync?: MailSyncCounts };
  [key: string]: unknown;
}

/** POST /api/recruitment-mails/{id}/review —— 只生成审批预览，不落库。 */
export interface MailReviewResponse {
  status?: string;
  processing_status?: MailProcessingStatus | string;
  previews?: Array<Record<string, unknown>>;
  approvals?: Array<Record<string, unknown>>;
  schedule_drafts?: Array<Record<string, unknown>>;
  stage_change?: {
    current_stage?: ApplicationStage | null;
    target_stage?: ApplicationStage | null;
  };
  reason?: string;
  freshness?: MailFreshness;
  [key: string]: unknown;
}

/** GET /api/recruitment-mails/{id} */
export interface MailDetailResponse {
  message?: RecruitmentMail;
  processing_status?: MailProcessingStatus | string;
  freshness?: MailFreshness;
  data?: { message?: RecruitmentMail };
  [key: string]: unknown;
}
