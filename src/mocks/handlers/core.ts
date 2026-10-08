import { http, HttpResponse } from "msw";
import { db } from "../db";
import { browseJobs } from "../query";
import { today } from "../data/_clock";
import { notFound, readJson, requireLocalUi, conflictIfStale, searchParamsOf, intParam } from "./_guards";
import { nextId } from "../data/_clock";
import type { ApplicationStage } from "@/types/domain";

const AUDIT_NOW = () => new Date().toISOString();

export const jobHandlers = [
  /** GET /api/jobs —— 旧端点，仍被 mock 出来以免有页面回退时踩空。 */
  http.get("/api/jobs", ({ request }) => {
    const params = searchParamsOf(request);
    const limit = intParam(params, "limit", 50);
    const offset = intParam(params, "offset", 0);
    const items = [...db.jobs.values()].slice(offset, offset + limit);
    return HttpResponse.json({ items, total: db.jobs.size, limit, offset });
  }),

  http.get("/api/jobs/browse", ({ request }) =>
    HttpResponse.json(
      browseJobs([...db.jobs.values()], {
        query: searchParamsOf(request).get("query") ?? undefined,
        company: searchParamsOf(request).get("company") ?? undefined,
        category: searchParamsOf(request).get("category") ?? undefined,
        platform: searchParamsOf(request).get("platform") ?? undefined,
        evaluation: searchParamsOf(request).get("evaluation") ?? undefined,
        score_band: searchParamsOf(request).get("score_band") ?? undefined,
        first_seen_on: searchParamsOf(request).get("first_seen_on") ?? undefined,
        sort: (searchParamsOf(request).get("sort") as "score" | "newest" | "company") ?? "score",
        limit: intParam(searchParamsOf(request), "limit", 50),
        offset: intParam(searchParamsOf(request), "offset", 0),
      }),
    ),
  ),

  /** 顺序要求：/api/jobs/:jobId 会匹配字面量 "browse"，所以 browse 路由必须排在它前面。 */
  http.get("/api/jobs/:jobId", ({ params }) => {
    const detail = db.jobDetails.get(String(params.jobId));
    if (!detail) return notFound("Job not found");
    return HttpResponse.json(detail);
  }),
];

export const companyHandlers = [
  http.get("/api/companies", () => HttpResponse.json(db.companies)),
];

export const systemHandlers = [
  http.get("/health", () =>
    HttpResponse.json({ status: "ok", mode: "approval_gated" }),
  ),
  http.get("/ready", () =>
    HttpResponse.json({
      status: "ready",
      checks: {
        companies_config: true,
        candidate_profile: true,
        crawler_import: true,
        postgres: true,
      },
      mode: "approval_gated",
    }),
  ),
  http.get("/api/reports/operational", ({ request }) => {
    const params = searchParamsOf(request);
    void params;
    const companies = db.companies.filter((item) => item.integration_status !== "connected");
    return HttpResponse.json({
      on: params.get("on") ?? today(),
      counts: {
        crawler_issues: companies.length,
        pending_jobs: [...db.jobs.values()].filter((item) => item.analysis_status === "pending").length,
        open_applications: db.applications.filter(
          (item) => !["rejected", "withdrawn"].includes(item.stage),
        ).length,
      },
      repair_candidates: companies.map((company) => ({
        company: company.name,
        crawler_key: company.crawler_key,
        type: company.integration_status === "unusable" ? "source_unusable" : "integration_pending",
        message:
          company.integration_status === "unusable"
            ? "来源不可用，需要人工替换入口"
            : "接入状态待确认",
        recommendation:
          company.integration_status === "unusable"
            ? "在数据接入里更新入口地址后重试"
            : "在数据接入里核对来源",
      })),
    });
  }),
];

export const applicationHandlers = [
  http.get("/api/applications", () => HttpResponse.json(db.applications)),

  http.get("/api/applications/page", ({ request }) => {
    const params = searchParamsOf(request);
    const limit = intParam(params, "limit", 50);
    const offset = intParam(params, "offset", 0);
    return HttpResponse.json({
      items: db.applications.slice(offset, offset + limit),
      total: db.applications.length,
      limit,
      offset,
    });
  }),

  /** POST /api/local-ui/applications —— 从岗位一键记录投递，重复时保留原阶段。 */
  http.post("/api/local-ui/applications", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<{ job_id?: string }>(request);
    const job = body.job_id ? db.jobs.get(body.job_id) : undefined;
    if (!job) return notFound("Job not found");
    const existing = db.applications.find((item) => item.job_id === job.id);
    if (existing) {
      return HttpResponse.json({ created: false, stage: existing.stage, application: existing });
    }
    const created = {
      id: nextId("app"),
      company_name: job.company_name,
      job_title: job.title,
      job_id: job.id,
      record_url: null,
      stage: "applied" as ApplicationStage,
      idempotency_key: `idem-${job.id}`,
      note: null,
      stage_history: [
        { stage: "applied", result: "进行中", changed_at: AUDIT_NOW(), source: "local_ui", source_label: "手动记录" },
      ],
      source_stage: "applied",
      source_status: "进行中",
      source_status_synced_at: AUDIT_NOW(),
      created_at: AUDIT_NOW(),
      updated_at: AUDIT_NOW(),
      source: "local_ui",
      source_ref: `local-ui:${job.id}`,
    };
    db.applications.push(created);
    job.application_stage = "applied";
    return HttpResponse.json({ created: true, stage: created.stage, application: created }, { status: 201 });
  }),

  http.post("/api/local-ui/applications/manual", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<{
      company_name?: string;
      job_title?: string;
      stage?: ApplicationStage;
      record_url?: string | null;
      note?: string;
    }>(request);
    if (!body.company_name || !body.job_title) {
      return HttpResponse.json({ detail: "company_name and job_title are required" }, { status: 422 });
    }
    const existing = db.applications.find(
      (item) => item.company_name === body.company_name && item.job_title === body.job_title,
    );
    if (existing) {
      return HttpResponse.json({ created: false, application: existing });
    }
    const stage = body.stage ?? "applied";
    const created = {
      id: nextId("app"),
      company_name: body.company_name,
      job_title: body.job_title,
      job_id: null,
      record_url: body.record_url || null,
      stage,
      idempotency_key: `idem-manual-${nextId("k")}`,
      note: body.note || null,
      stage_history: [{ stage, result: "进行中", changed_at: AUDIT_NOW(), source: "local_ui", source_label: "手动记录" }],
      source_stage: stage,
      source_status: null,
      source_status_synced_at: null,
      created_at: AUDIT_NOW(),
      updated_at: AUDIT_NOW(),
      source: "local_ui",
      source_ref: "local-ui:manual",
    };
    db.applications.push(created);
    return HttpResponse.json({ created: true, application: created }, { status: 201 });
  }),

  http.patch("/api/local-ui/applications/:id", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const application = db.applications.find((item) => item.id === String(params.id));
    if (!application) return notFound("Application not found");
    const body = await readJson<{
      stage?: ApplicationStage;
      result?: string;
      note?: string;
      expected_updated_at?: string;
    }>(request);
    const stale = conflictIfStale(application.updated_at, body.expected_updated_at);
    if (stale) return stale;
    if (body.stage) {
      application.stage_history.push({
        stage: body.stage,
        result: body.result,
        changed_at: AUDIT_NOW(),
        source: "local_ui",
        source_label: "手动记录",
      });
      application.stage = body.stage;
    }
    application.note = body.note ?? application.note;
    application.updated_at = AUDIT_NOW();
    return HttpResponse.json(application);
  }),

  http.patch("/api/local-ui/applications/:id/record-url", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const application = db.applications.find((item) => item.id === String(params.id));
    if (!application) return notFound("Application not found");
    const body = await readJson<{ record_url?: string; expected_updated_at?: string }>(request);
    const stale = conflictIfStale(application.updated_at, body.expected_updated_at);
    if (stale) return stale;
    if (!body.record_url) {
      return HttpResponse.json({ detail: "record_url is required" }, { status: 422 });
    }
    application.record_url = body.record_url;
    application.updated_at = AUDIT_NOW();
    return HttpResponse.json(application);
  }),

  /** 删除投递同时清掉关联日程；邮件只解除关联，不删除。 */
  http.delete("/api/local-ui/applications/:id", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const index = db.applications.findIndex((item) => item.id === String(params.id));
    if (index === -1) return notFound("Application not found");
    const body = await readJson<{ expected_updated_at?: string }>(request);
    const stale = conflictIfStale(db.applications[index].updated_at, body.expected_updated_at);
    if (stale) return stale;
    const [removed] = db.applications.splice(index, 1);
    db.schedule = db.schedule.filter((event) => event.application_id !== removed.id);
    db.mails.forEach((mail) => {
      if (mail.application_id === removed.id) mail.application_id = null;
    });
    const job = removed.job_id ? db.jobs.get(removed.job_id) : undefined;
    if (job) job.application_stage = null;
    return HttpResponse.json({ status: "deleted", id: removed.id }, { status: 204 });
  }),

  /** POST /api/local-ui/applications/{id}/events —— 从投递卡直接加日程。 */
  http.post("/api/local-ui/applications/:id/events", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const application = db.applications.find((item) => item.id === String(params.id));
    if (!application) return notFound("Application not found");
    const body = await readJson<{
      event_type?: string;
      event_date?: string;
      event_time?: string | null;
      note?: string;
    }>(request);
    if (!body.event_type || !body.event_date) {
      return HttpResponse.json({ detail: "event_type and event_date are required" }, { status: 422 });
    }
    const event = {
      id: nextId("sch"),
      title: `${application.company_name} · ${body.event_type}`,
      event_date: body.event_date,
      status: "pending" as const,
      time_kind: "appointment" as const,
      event_time: body.event_time ?? null,
      event_type: body.event_type,
      company_name: application.company_name,
      job_title: application.job_title,
      application_stage: application.stage,
      starts_at: null,
      ends_at: null,
      application_id: application.id,
      location_or_link: null,
      note: body.note ?? null,
      created_at: AUDIT_NOW(),
      updated_at: AUDIT_NOW(),
      source: "local_ui",
      source_ref: `local-ui:${application.id}`,
    };
    db.schedule.push(event);
    return HttpResponse.json({ status: "created", event }, { status: 201 });
  }),
];

export const scheduleHandlers = [
  http.get("/api/schedule", ({ request }) => {
    const on = searchParamsOf(request).get("on");
    const all = db.schedule.slice().sort((left, right) =>
      String(left.event_date ?? "9999").localeCompare(String(right.event_date ?? "9999")),
    );
    return HttpResponse.json(on ? all.filter((event) => event.event_date === on) : all);
  }),

  http.post("/api/local-ui/events", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<Record<string, unknown>>(request);
    if (!body.title || !body.company_name) {
      return HttpResponse.json({ detail: "title and company_name are required" }, { status: 422 });
    }
    const event = {
      id: nextId("sch"),
      title: String(body.title),
      event_date: (body.event_date as string) ?? null,
      status: "pending" as const,
      time_kind: ((body.time_kind as string) ?? "appointment") as "appointment",
      event_time: (body.event_time as string) ?? null,
      event_type: String(body.event_type ?? "其他"),
      company_name: String(body.company_name),
      job_title: String(body.job_title ?? ""),
      application_stage: "applied" as ApplicationStage,
      starts_at: null,
      ends_at: null,
      application_id: (body.application_id as string) ?? null,
      location_or_link: (body.location_or_link as string) ?? null,
      note: (body.note as string) ?? null,
      created_at: AUDIT_NOW(),
      updated_at: AUDIT_NOW(),
      source: "local_ui",
      source_ref: `local-ui:${nextId("ref")}`,
    };
    db.schedule.push(event);
    return HttpResponse.json({ status: "created", event }, { status: 201 });
  }),

  http.patch("/api/local-ui/events/:id", async ({ params, request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const event = db.schedule.find((item) => item.id === String(params.id));
    if (!event) return notFound("Schedule event not found");
    const body = await readJson<Record<string, unknown> & { expected_updated_at?: string }>(request);
    const stale = conflictIfStale(event.updated_at, body.expected_updated_at);
    if (stale) return stale;
    for (const key of [
      "title",
      "event_type",
      "company_name",
      "job_title",
      "event_date",
      "event_time",
      "time_kind",
      "status",
      "application_id",
      "note",
      "location_or_link",
    ] as const) {
      if (key in body) {
        (event as unknown as Record<string, unknown>)[key] = body[key];
      }
    }
    event.updated_at = AUDIT_NOW();
    return HttpResponse.json({ status: "updated", event });
  }),
];
