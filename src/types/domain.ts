/**
 * 领域类型。字段名与上游 Pydantic 模型逐一对齐：
 * `packages/domain/models.py`（StrictModel / extra="forbid"）。
 * 因此 mock 数据多写一个字段在真后端会被拒，这里也保持同样的严格性。
 */

export type ISODateTime = string;
export type ISODate = string;
export type ISOTime = string;

/** 上游 AuditFields：所有持久化实体都带这四个字段。 */
export interface AuditFields {
  created_at: ISODateTime;
  updated_at: ISODateTime;
  source: string;
  source_ref?: string | null;
}

export type RecruitmentBatch = "formal" | "early" | "internship" | "unknown";

export type ApplicationStage =
  | "interested"
  | "applied"
  | "assessment"
  | "written"
  | "interview1"
  | "interview2"
  | "interview3"
  | "hr"
  | "offer"
  | "rejected"
  | "withdrawn";

export type TaskStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "stopped";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type JobEvaluation =
  | "scored"
  | "unscored"
  | "pending"
  | "jd_incomplete"
  | "excluded";

export type JobScoreBand = "high" | "medium" | "low";
export type JobSort = "score" | "newest" | "company";

export interface Company extends AuditFields {
  id: string;
  name: string;
  aliases: string[];
  campus_url?: string | null;
  crawler_key?: string | null;
  integration_status: string;
  organization_id?: string | null;
  recruitment_unit_name?: string | null;
  source_identity?: string | null;
}

export interface Job extends AuditFields {
  id: string;
  company_id: string;
  title: string;
  city?: string | null;
  detail_url: string;
  jd_raw?: string | null;
  cohort?: number | null;
  cohort_status: string;
  batch: RecruitmentBatch;
  match_score?: number | null;
  first_seen_at?: ISODateTime | null;
  last_seen_at?: ISODateTime | null;
  organization_id?: string | null;
  recruitment_unit_id?: string | null;
  recruitment_campaign_id?: string | null;
  source_platform?: string | null;
  source_tenant?: string | null;
  native_job_id?: string | null;
  normalized_detail_url?: string | null;
  business_key?: string | null;
  capture_status: string;
  capture_failure_reason: string;
  availability_status: string;
  title_key?: string | null;
  capture_evidence: Record<string, unknown>;
}

export interface JobAnalysis {
  match_score?: number | null;
  advantages: string[];
  gaps: string[];
  summary?: string | null;
  recommendation?: string | null;
  score_breakdown: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
  evidence_level?: string | null;
  matched_directions: string[];
  primary_match_direction?: string | null;
  analysis_status?: string | null;
  model?: string | null;
  analysis_version?: string | null;
  prompt_version?: string | null;
  content_fingerprint?: string | null;
  profile_fingerprint?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  filter_reasons: string[];
  refusal_reason?: string | null;
  error_code?: string | null;
  analyzed_at?: ISODateTime | null;
}

/** GET /api/jobs/{job_id} */
export interface JobDetail {
  job: Job;
  analysis?: JobAnalysis | null;
}

/** GET /api/jobs —— 旧端点，仍是分页壳。 */
export interface JobPage {
  items: Job[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /api/jobs/browse 的列表项：不回传完整 JD 文本。 */
export interface JobBrowseItem {
  id: string;
  company_id: string;
  company_name: string;
  organization_id?: string | null;
  title: string;
  city?: string | null;
  detail_url: string;
  category: string;
  category_label: string;
  platform: string;
  batch: RecruitmentBatch;
  capture_status: string;
  capture_failure_reason: string;
  availability_status: string;
  match_score?: number | null;
  recommendation?: string | null;
  summary?: string | null;
  advantages: string[];
  gaps: string[];
  matched_directions: string[];
  primary_match_direction?: string | null;
  analysis_status?: string | null;
  first_seen_at?: ISODateTime | null;
  application_stage?: ApplicationStage | null;
}

/** facets.companies —— 按集团归并后的公司摘要。 */
export interface CompanyJobSummary {
  key: string;
  name: string;
  company_ids: string[];
  recruitment_units: string[];
  campus_url?: string | null;
  job_count: number;
  average_score?: number | null;
  top_score?: number | null;
  top_job?: string | null;
}

export interface JobBrowseStats {
  jobs: number;
  companies: number;
  high_match: number;
  unscored: number;
  pending: number;
  jd_incomplete: number;
  excluded: number;
}

export interface JobBrowseFacets {
  companies: CompanyJobSummary[];
  /** category value -> 中文展示名 */
  categories: Record<string, string>;
  platforms: string[];
}

/** GET /api/jobs/browse */
export interface JobBrowsePage {
  items: JobBrowseItem[];
  featured: JobBrowseItem[];
  total: number;
  limit: number;
  offset: number;
  stats: JobBrowseStats;
  facets: JobBrowseFacets;
}

export interface StageHistoryEntry extends Record<string, unknown> {
  stage?: ApplicationStage | string;
  to_stage?: ApplicationStage | string;
  status?: string;
  result?: string;
  changed_at?: ISODateTime;
  at?: ISODateTime;
  created_at?: ISODateTime;
  date?: ISODateTime;
  source?: string;
  source_type?: string;
  source_ref?: string;
  source_label?: string;
  source_name?: string;
}

export interface Application extends AuditFields {
  id: string;
  company_name: string;
  job_title: string;
  job_id?: string | null;
  record_url?: string | null;
  stage: ApplicationStage;
  idempotency_key: string;
  note?: string | null;
  stage_history: StageHistoryEntry[];
  source_stage?: string | null;
  source_status?: string | null;
  source_status_synced_at?: ISODateTime | null;
}

/** GET /api/applications/page */
export interface ApplicationPage {
  items: Application[];
  total: number;
  limit: number;
  offset: number;
}

export type ScheduleStatus = "pending" | "completed" | "ignored";
export type ScheduleTimeKind = "appointment" | "deadline" | "unspecified";

export interface ScheduleEvent extends AuditFields {
  id: string;
  title: string;
  event_date?: ISODate | null;
  status: ScheduleStatus;
  time_kind: ScheduleTimeKind;
  event_time?: ISOTime | null;
  event_type: string;
  company_name: string;
  job_title: string;
  application_stage: ApplicationStage;
  starts_at?: ISODateTime | null;
  ends_at?: ISODateTime | null;
  application_id?: string | null;
  location_or_link?: string | null;
  note?: string | null;
}

/** GET /api/approvals 的列表项：审批令牌 + 预览。 */
export interface ApprovalPreview {
  task_id: string;
  operation: string;
  idempotency_key: string;
  evidence_summary?: string | null;
  evidence?: Array<{ source: string; source_ref?: string | null; summary?: string | null } | string>;
  expires_at: ISODateTime;
  created_at: ISODateTime;
  target_id?: string | null;
  payload: Record<string, unknown>;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  cohort?: number | null;
  cohort_status?: string | null;
  jd_raw?: string | null;
  current_stage?: ApplicationStage | null;
  target_stage?: ApplicationStage | null;
}

export interface ApprovalToken {
  token_id: string;
  task_id: string;
  operation: string;
  idempotency_key: string;
  evidence_summary: string;
  evidence_digest: string;
  issued_at: ISODateTime;
  expires_at: ISODateTime;
  status: ApprovalStatus;
  consumed: boolean;
  consumed_at?: ISODateTime | null;
}

/**
 * GET /api/approvals 实际返回 `{ token, preview }` 包裹，
 * 前端 normalizeApprovals 会摊平成 `{ ...token, preview }`（app.js:473）。
 */
export interface ApprovalEnvelope {
  token: ApprovalToken;
  preview?: ApprovalPreview | null;
}

export type FlatApproval = ApprovalToken & { preview?: ApprovalPreview | null };

export interface TaskRun extends AuditFields {
  id: string;
  task_type: string;
  status: TaskStatus;
  user_request: string;
  current_step?: string | null;
  step_count: number;
  max_steps: number;
  error_code?: string | null;
}

export interface ToolCall extends AuditFields {
  id: string;
  task_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result_summary?: string | null;
  success?: boolean | null;
  latency_ms?: number | null;
  error_code?: string | null;
}

/** GET /health、GET /ready */
export interface ServiceStatus {
  status: string;
  mode: string;
  checks?: Record<string, boolean>;
}

/** GET /api/reports/operational —— 无严格模型，前端只读这两个键。 */
export interface OperationalReport {
  counts?: Record<string, number>;
  repair_candidates?: Array<{
    company?: string;
    crawler_key?: string;
    type?: string;
    message?: string;
    recommendation?: string;
  }>;
}
