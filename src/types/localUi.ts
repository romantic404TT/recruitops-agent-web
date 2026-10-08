/**
 * 本机 UI 写入端点（前缀 `/api/local-ui`）的请求/响应体。
 * 上游全部要求 `X-RecruitOps-Local-UI: 1` 同源标记头，
 * 且除创建类接口外都走 `expected_updated_at` 乐观并发（不匹配返回 409）。
 */
import type {
  Application,
  ApplicationStage,
  ISODateTime,
  ScheduleEvent,
} from "./domain";

export type ApplicationResult = "待" | "进行中" | "通过" | "淘汰" | "放弃";

/** PATCH /api/local-ui/applications/{id} */
export interface ApplicationEditBody {
  stage: ApplicationStage;
  result?: ApplicationResult;
  note?: string;
  expected_updated_at: ISODateTime;
}

/** PATCH /api/local-ui/applications/{id}/record-url */
export interface ApplicationLinkBody {
  record_url: string;
  expected_updated_at: ISODateTime;
}

/** DELETE /api/local-ui/applications/{id} */
export interface ApplicationDeleteBody {
  expected_updated_at: ISODateTime;
}

/** POST /api/local-ui/applications —— 从岗位一键记录投递。 */
export interface ApplicationRecordBody {
  job_id: string;
}

export interface ApplicationRecordResponse {
  created: boolean;
  stage: ApplicationStage;
  application?: Application;
  [key: string]: unknown;
}

/** POST /api/local-ui/applications/manual —— 手填投递。 */
export interface ManualApplicationBody {
  company_name: string;
  job_title: string;
  stage?: ApplicationStage;
  record_url?: string | null;
  note?: string;
}

export interface ManualApplicationResponse {
  created: boolean;
  application?: Application;
  [key: string]: unknown;
}

/**
 * POST /api/local-ui/events —— 新建日程。
 * 上游 201 + {status:"created", event}；PATCH 同壳，status 为 "updated"。
 */
export interface ScheduleEventCreateBody {
  title: string;
  event_type: string;
  event_date?: string | null;
  event_time?: string | null;
  company_name: string;
  job_title?: string;
  application_id?: string | null;
  location_or_link?: string | null;
  note?: string | null;
  time_kind?: "appointment" | "deadline" | "unspecified";
}

/** PATCH /api/local-ui/events/{id} —— 全部字段可选，外加并发戳。 */
export interface ScheduleEventPatchBody {
  title?: string | null;
  event_type?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  time_kind?: "appointment" | "deadline" | "unspecified" | null;
  status?: "pending" | "completed" | "ignored" | null;
  application_id?: string | null;
  note?: string | null;
  location_or_link?: string | null;
  expected_updated_at: ISODateTime;
}

export interface ScheduleEventMutationResponse {
  status: "created" | "updated";
  event: ScheduleEvent;
}

/** POST /api/local-ui/applications/{id}/events */
export interface ApplicationEventBody {
  event_type: string;
  event_date: string;
  event_time?: string | null;
  note?: string;
}
