import type { ISODateTime } from "./domain";

/**
 * 公司来源登记表状态。上游 SOURCE_STATUSES 共 6 个值，
 * 但 `unusable` 不会出现在默认列表里（list_sources 显式过滤掉了）。
 */
export type CompanySourceStatus =
  | "pending"
  | "running"
  | "complete"
  | "partial"
  | "failed"
  | "unusable";

/** 一次抓取尝试的收据。 */
export interface CompanySourceAttempt {
  id: string;
  record_id: string;
  status: CompanySourceStatus;
  attempted_url?: string | null;
  final_url?: string | null;
  failure_stage?: string | null;
  reason_code?: string | null;
  reason?: string | null;
  job_count?: number | null;
  jd_pending_count?: number | null;
  pagination_complete?: boolean | null;
  attempted_at?: ISODateTime | null;
}

/** GET /api/company-sources 的列表项（_record_dict）。 */
export interface CompanySourceRecord {
  id: string;
  company_name: string;
  source: string;
  source_record_id?: string | null;
  source_url?: string | null;
  company_id?: string | null;
  entry_url?: string | null;
  original_entry_url?: string | null;
  final_url?: string | null;
  status: CompanySourceStatus;
  failure_stage?: string | null;
  reason_code?: string | null;
  reason?: string | null;
  job_count?: number | null;
  jd_pending_count?: number | null;
  last_success_job_count?: number | null;
  pagination_complete?: boolean | null;
  last_attempt_at?: ISODateTime | null;
  updated_at: ISODateTime;
  /** 仅 GET /{id} 详情里带。 */
  attempts?: CompanySourceAttempt[];
  attempts_total?: number;
}

export interface CompanySourceListResponse {
  items: CompanySourceRecord[];
  total: number;
  page: number;
  page_size: number;
}

/** GET /api/company-sources/{id}/jobs */
export interface CompanySourceJob {
  id: string;
  title: string;
  city?: string | null;
  detail_url?: string | null;
  match_score?: number | null;
  first_seen_at?: ISODateTime | null;
  [key: string]: unknown;
}

export interface CompanySourceJobPage {
  items: CompanySourceJob[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * PATCH /{id}/entry 与 DELETE 投递一样走乐观并发：
 * 必须回传读取时的 updated_at，不匹配上游返回 409。
 */
export interface CompanySourceEntryPatch {
  entry_url: string;
  expected_updated_at: ISODateTime;
}

/** POST /{id}/retry → 202 */
export interface CompanySourceRetryResponse {
  id: string;
  status: "running";
}
