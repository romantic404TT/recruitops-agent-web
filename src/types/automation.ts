import type { ISODateTime } from "./domain";

export type AutomationFrequency = "daily" | (string & {});

/** last_status 的已知取值（前端 AUTOMATION_STATUS_LABELS，app.js:2101）。 */
export type AutomationLastStatus = "running" | "succeeded" | "failed" | "blocked";

export interface AutomationExecution {
  id: string;
  status: string;
  scheduled_for?: ISODateTime | null;
  started_at?: ISODateTime | null;
  completed_at?: ISODateTime | null;
  result_summary?: string | null;
  error?: string | null;
  thread_id?: string | null;
  turn_id?: string | null;
}

/** GET /api/automations 的单条（字段逐一对应 _automation_payload）。 */
export interface Automation {
  id: string;
  task_id: string;
  task_label: string;
  target_kind: string;
  target_id?: string | null;
  target_label?: string | null;
  frequency: AutomationFrequency;
  /** 上游格式化为 "%H:%M" */
  start_time: string;
  timezone: string;
  active: boolean;
  runnable: boolean;
  blocked_reason?: string | null;
  next_run_at?: ISODateTime | null;
  last_run_at?: ISODateTime | null;
  last_status?: AutomationLastStatus | string | null;
  last_error?: string | null;
  latest_execution?: AutomationExecution | null;
}

export interface AutomationEngine {
  enabled: boolean;
  status: string;
  blocked_reason?: string | null;
}

export interface AutomationListResponse {
  items: Automation[];
  total: number;
  engine: AutomationEngine;
}
