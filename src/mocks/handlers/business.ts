import { http, HttpResponse } from "msw";
import { db } from "../db";
import { nextId } from "../data/_clock";
import { notFound, readJson, requireLocalUi, searchParamsOf, intParam } from "./_guards";
import type {
  ApprovalEnvelope,
  ApprovalPreview,
  ApprovalStatus,
  ApplicationStage,
} from "@/types/domain";
import type { MailFreshness } from "@/types/mail";

const AUDIT_NOW = () => new Date().toISOString();

function mailFreshness(): MailFreshness {
  if (!db.mailConfigured) return { status: "disabled", synced_at: db.mailLastSyncAt, error_type: null };
  return { status: "synced", synced_at: db.mailLastSyncAt, error_type: null };
}

// ------------------------------------------------------------------ 邮件

export const mailHandlers = [
  http.get("/api/recruitment-mails", ({ request }) => {
    const limit = intParam(searchParamsOf(request), "limit", 50);
    return HttpResponse.json({
      items: db.mails.slice(0, limit),
      total: db.mails.length,
      unavailable: !db.mailConfigured,
      freshness: mailFreshness(),
    });
  }),

  http.post("/api/recruitment-mails/sync", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    if (!db.mailConfigured) {
      return HttpResponse.json(
        {
          status: "skipped",
          reason: "邮箱连接未配置",
          sync: { fetched: 0, inserted: 0, reused: 0 },
          freshness: { status: "disabled", synced_at: null, error_type: "mail_not_configured" },
        },
        { status: 200 },
      );
    }
    db.mailLastSyncAt = AUDIT_NOW();
    return HttpResponse.json({
      status: "synced",
      sync: { fetched: db.mails.length, inserted: 0, reused: db.mails.length },
      freshness: mailFreshness(),
    });
  }),

  /** 详情路由排在 sync 之后：两者前缀不同，不会互相吞。 */
  http.get("/api/recruitment-mails/:recordId", ({ params }) => {
    const mail = db.mails.find((item) => item.id === String(params.recordId));
    if (!mail) return notFound("Recruitment mail not found");
    return HttpResponse.json({ message: mail, processing_status: mail.processing_status, freshness: mailFreshness() });
  }),

  http.post("/api/recruitment-mails/:recordId/review", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const mail = db.mails.find((item) => item.id === String(params.recordId));
    if (!mail) return notFound("Recruitment mail not found");
    const application = mail.application_id
      ? db.applications.find((item) => item.id === mail.application_id)
      : undefined;
    return HttpResponse.json({
      status: "preview",
      processing_status: mail.processing_status,
      freshness: mailFreshness(),
      stage_change: application
        ? { current_stage: application.stage, target_stage: application.stage }
        : null,
      schedule_drafts: mail.category === "interview" || mail.category === "written_test"
        ? [
            {
              title: `${mail.company_name ?? "公司待确认"} · ${mail.category === "interview" ? "面试" : "笔试"}`,
              event_type: mail.category === "interview" ? "面试" : "笔试",
              company_name: mail.company_name ?? "",
              job_title: mail.job_title ?? "",
              note: "由邮件关联预览生成，需人工确认后才写入日程。",
            },
          ]
        : [],
      previews: [
        {
          operation: "application_stage_update",
          idempotency_key: `preview-${mail.id}`,
          evidence_summary: `来自邮件 ${mail.id}，置信度 ${mail.confidence ?? "未给出"}。`,
          target_id: mail.application_id ?? null,
        },
      ],
    });
  }),
];

// ------------------------------------------------------------------ 审批

function withStatus(approval: ApprovalEnvelope, status: ApprovalStatus): void {
  approval.token.status = status;
}

export const approvalHandlers = [
  http.get("/api/approvals", () => HttpResponse.json(db.approvals)),

  /** POST /api/approvals —— 登记一个预览，body 就是 preview 本体。 */
  http.post("/api/approvals", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const preview = await readJson<Partial<ApprovalPreview>>(request);
    if (!preview.operation || !preview.idempotency_key) {
      return HttpResponse.json({ detail: "operation and idempotency_key are required" }, { status: 422 });
    }
    const exists = db.approvals.some(
      (item) => item.token.idempotency_key === preview.idempotency_key,
    );
    if (exists) {
      return HttpResponse.json({ detail: "幂等键已存在，未重复登记" }, { status: 409 });
    }
    const tokenId = nextId("tok");
    const taskId = preview.task_id ?? nextId("task");
    db.approvals.push({
      token: {
        token_id: tokenId,
        task_id: taskId,
        operation: preview.operation,
        idempotency_key: preview.idempotency_key,
        evidence_summary: preview.evidence_summary ?? "未提供",
        evidence_digest: `sha256:${preview.idempotency_key}`,
        issued_at: AUDIT_NOW(),
        expires_at: preview.expires_at ?? AUDIT_NOW(),
        status: "pending",
        consumed: false,
        consumed_at: null,
      },
      preview: {
        task_id: taskId,
        operation: preview.operation,
        idempotency_key: preview.idempotency_key,
        evidence_summary: preview.evidence_summary ?? null,
        evidence: preview.evidence ?? [],
        expires_at: preview.expires_at ?? AUDIT_NOW(),
        created_at: AUDIT_NOW(),
        target_id: preview.target_id ?? null,
        payload: preview.payload ?? {},
        before: preview.before ?? null,
        after: preview.after ?? null,
      },
    });
    return HttpResponse.json({ token_id: tokenId }, { status: 201 });
  }),

  http.post("/api/approvals/:tokenId/approve", ({ params }) => {
    const approval = db.approvals.find((item) => item.token.token_id === String(params.tokenId));
    if (!approval) return notFound("Approval not found");
    if (approval.token.status !== "pending") {
      return HttpResponse.json({ detail: "该审批已处理，不能再次决定" }, { status: 409 });
    }
    withStatus(approval, "approved");
    return HttpResponse.json(approval);
  }),

  http.post("/api/approvals/:tokenId/reject", ({ params }) => {
    const approval = db.approvals.find((item) => item.token.token_id === String(params.tokenId));
    if (!approval) return notFound("Approval not found");
    if (approval.token.status !== "pending") {
      return HttpResponse.json({ detail: "该审批已处理，不能再次决定" }, { status: 409 });
    }
    withStatus(approval, "rejected");
    return HttpResponse.json(approval);
  }),

  /**
   * 执行已批准操作：真的把 preview.after 落到投递/日程上，
   * 并把令牌标成 consumed（一次性），与上游语义一致。
   */
  http.post("/api/approvals/:tokenId/execute", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const approval = db.approvals.find((item) => item.token.token_id === String(params.tokenId));
    if (!approval) return notFound("Approval not found");
    const body = await readJson<{ operator?: string }>(request);
    if (!body.operator) {
      return HttpResponse.json({ detail: "operator is required" }, { status: 422 });
    }
    if (approval.token.status !== "approved") {
      return HttpResponse.json({ detail: "只有已批准的审批可以执行" }, { status: 409 });
    }
    if (approval.token.consumed) {
      return HttpResponse.json({ detail: "该令牌已被使用" }, { status: 409 });
    }
    const preview = approval.preview;
    const applied: string[] = [];
    if (preview?.operation === "application_stage_update" && preview.after?.stage) {
      const application = db.applications.find((item) => item.id === preview.target_id);
      if (application) {
        application.stage = preview.after.stage as never;
        application.stage_history.push({
          stage: preview.after.stage as ApplicationStage,
          result: "进行中",
          changed_at: AUDIT_NOW(),
          source: `approval:${approval.token.token_id}`,
          source_label: `审批执行（${body.operator}）`,
        });
        application.updated_at = AUDIT_NOW();
        const job = application.job_id ? db.jobs.get(application.job_id) : undefined;
        if (job) job.application_stage = application.stage;
        applied.push(`application:${application.id}`);
      }
    }
    if (preview?.operation === "schedule_create" && preview.after) {
      const after = preview.after as Record<string, unknown>;
      const event = {
        id: nextId("sch"),
        title: String(after.title ?? "未命名事项"),
        event_date: (after.event_date as string) ?? null,
        status: "pending" as const,
        time_kind: ((after.time_kind as string) ?? "appointment") as "appointment",
        event_time: (after.event_time as string) ?? null,
        event_type: String(after.event_type ?? "其他"),
        company_name: String(after.company_name ?? ""),
        job_title: String(after.job_title ?? ""),
        application_stage: "applied" as never,
        starts_at: null,
        ends_at: null,
        application_id: null,
        location_or_link: null,
        note: String(after.note ?? "由审批执行写入"),
        created_at: AUDIT_NOW(),
        updated_at: AUDIT_NOW(),
        source: `approval:${approval.token.token_id}`,
        source_ref: body.operator,
      };
      db.schedule.push(event);
      applied.push(`schedule:${event.id}`);
    }
    approval.token.consumed = true;
    approval.token.consumed_at = AUDIT_NOW();
    approval.token.status = "expired";
    return HttpResponse.json({ status: "executed", applied, operator: body.operator });
  }),
];

// ------------------------------------------------------------------ 定时任务

export const automationHandlers = [
  http.get("/api/automations", ({ request }) => {
    const activeOnly = searchParamsOf(request).get("active_only") === "true";
    const items = activeOnly ? db.automations.filter((item) => item.active) : db.automations;
    return HttpResponse.json({
      items,
      total: db.automations.length,
      engine: { enabled: true, status: "running", blocked_reason: null },
    });
  }),

  http.post("/api/automations/:scheduleId/disable", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const automation = db.automations.find((item) => item.id === String(params.scheduleId));
    if (!automation) return notFound("Schedule not found");
    automation.active = false;
    automation.runnable = false;
    automation.next_run_at = null;
    return HttpResponse.json({ status: "disabled", id: automation.id });
  }),
];

// ------------------------------------------------------------------ 数据接入

export const companySourceHandlers = [
  http.get("/api/company-sources", ({ request }) => {
    const params = searchParamsOf(request);
    const page = intParam(params, "page", 1);
    const pageSize = intParam(params, "page_size", 30);
    const q = (params.get("q") ?? "").trim().toLowerCase();
    const status = params.get("status");
    if (status && !["pending", "running", "complete", "partial", "failed"].includes(status)) {
      return HttpResponse.json({ detail: "Unsupported source status" }, { status: 422 });
    }
    let items = db.companySources.filter((record) => record.status !== "unusable");
    if (q) {
      items = items.filter((record) =>
        [record.company_name, record.source, record.source_record_id ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (status) items = items.filter((record) => record.status === status);
    items = items.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    return HttpResponse.json({
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      page_size: pageSize,
    });
  }),

  http.get("/api/company-sources/:recordId", ({ params }) => {
    const record = db.companySources.find((item) => item.id === String(params.recordId));
    if (!record) return notFound("Company source not found");
    return HttpResponse.json({
      ...record,
      attempts: [
        {
          id: `att-${record.id}`,
          record_id: record.id,
          status: record.status,
          attempted_url: record.entry_url,
          final_url: record.final_url,
          failure_stage: record.failure_stage,
          reason_code: record.reason_code,
          reason: record.reason,
          job_count: record.job_count,
          jd_pending_count: record.jd_pending_count,
          pagination_complete: record.pagination_complete,
          attempted_at: record.last_attempt_at,
        },
      ],
      attempts_total: 1,
    });
  }),

  http.get("/api/company-sources/:recordId/jobs", ({ params, request }) => {
    const record = db.companySources.find((item) => item.id === String(params.recordId));
    if (!record) return notFound("Company source not found");
    const queryParams = searchParamsOf(request);
    const page = intParam(queryParams, "page", 1);
    const pageSize = intParam(queryParams, "page_size", 30);
    const items = [...db.jobs.values()]
      .filter((job) => job.company_id === record.company_id)
      .slice((page - 1) * pageSize, page * pageSize);
    return HttpResponse.json({ items, total: items.length, page, page_size: pageSize });
  }),

  http.patch("/api/company-sources/:recordId/entry", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const record = db.companySources.find((item) => item.id === String(params.recordId));
    if (!record) return notFound("Company source not found");
    const body = await readJson<{ entry_url?: string; expected_updated_at?: string }>(request);
    if (!body.entry_url || String(body.entry_url).length > 2048) {
      return HttpResponse.json({ detail: "entry_url is required and must be <= 2048 chars" }, { status: 422 });
    }
    if (String(body.expected_updated_at) !== String(record.updated_at)) {
      return HttpResponse.json({ detail: "Record changed; refresh and retry" }, { status: 409 });
    }
    record.entry_url = body.entry_url;
    record.status = "pending";
    record.reason = "入口地址已人工更新，等待下一次抓取。";
    record.updated_at = AUDIT_NOW();
    return HttpResponse.json(record);
  }),

  http.post("/api/company-sources/:recordId/retry", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const record = db.companySources.find((item) => item.id === String(params.recordId));
    if (!record) return notFound("Company source not found");
    if (record.status === "running") {
      return HttpResponse.json({ detail: "该来源正在抓取中" }, { status: 409 });
    }
    record.status = "running";
    record.updated_at = AUDIT_NOW();
    // 真后端这里会派生一个只读抓取任务；mock 只把它切成 running 并保留原因。
    record.reason = "已重新排队，等待下一轮只读抓取。";
    return HttpResponse.json({ id: record.id, status: "running" }, { status: 202 });
  }),
];
