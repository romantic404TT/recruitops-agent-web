import { isoAt } from "./_clock";
import type { ApprovalEnvelope } from "@/types/domain";
import type { Automation } from "@/types/automation";
import type { CodexTrace } from "@/types/codex";

/**
 * 定时任务 fixture：覆盖 active/inactive、四种 last_status，
 * 以及 latest_execution 缺失（从未执行）这一分支。
 */
const AUTOMATION_SEEDS = [
  {
    id: "auto-5001", task_id: "daily_recruitment_intel", task_label: "每日招聘情报",
    target_kind: "all", target_label: "全部已接入公司", frequency: "daily", start_time: "03:30",
    active: true, last_status: "succeeded", run_offset: 0, next_offset: 1,
    result_summary:
      "本轮共检查 11 家公司，新增确认岗位 6 个，完成评分 5 个，1 个岗位 JD 待补全；未发现异常。",
    error: null,
  },
  {
    id: "auto-5002", task_id: "daily_application_status_review", task_label: "每日投递进度复核",
    target_kind: "application", target_label: "全部进行中的投递", frequency: "daily", start_time: "09:00",
    active: true, last_status: "failed", run_offset: -1, next_offset: 1,
    result_summary: null,
    error:
      "拼多多投递进度页返回 403，需要人工在浏览器中完成一次验证后重试；其余 9 条投递已复核完成。",
  },
  {
    id: "auto-5003", task_id: "daily_mail_digest", task_label: "每日招聘邮件整理",
    target_kind: "mail", target_label: "INBOX 未读招聘邮件", frequency: "daily", start_time: "20:00",
    active: true, last_status: "blocked", run_offset: -2, next_offset: 1,
    result_summary: null, error: "邮箱连接未配置，任务在准备阶段被安全跳过。",
  },
  {
    id: "auto-5004", task_id: "weekly_company_coverage_report", task_label: "每周公司覆盖盘点",
    target_kind: "report", target_label: "全部来源公司", frequency: "weekly", start_time: "07:00",
    active: false, last_status: "running", run_offset: -6, next_offset: 0,
    result_summary: "上一次执行：已接入 9 家，待确认 5 家，来源总数 14 家。", error: null,
  },
  {
    id: "auto-5005", task_id: "interview_reminder", task_label: "面试前一天提醒",
    target_kind: "schedule", target_label: "全部待处理日程", frequency: "daily", start_time: "21:30",
    active: true, last_status: "running", run_offset: 0, next_offset: 1,
    result_summary: null, error: null,
  },
] as const;

export function buildAutomations(): Automation[] {
  return AUTOMATION_SEEDS.map((seed) => {
    const neverRan = seed.id === "auto-5005";
    return {
      id: seed.id,
      task_id: seed.task_id,
      task_label: seed.task_label,
      target_kind: seed.target_kind,
      target_id: null,
      target_label: seed.target_label,
      frequency: seed.frequency,
      start_time: seed.start_time,
      timezone: "Asia/Shanghai",
      active: seed.active,
      runnable: seed.active && seed.last_status !== "blocked",
      blocked_reason: seed.last_status === "blocked" ? "邮箱连接未配置" : null,
      next_run_at: seed.active ? isoAt(seed.next_offset, Number(seed.start_time.slice(0, 2)), Number(seed.start_time.slice(3))) : null,
      last_run_at: neverRan ? null : isoAt(seed.run_offset, Number(seed.start_time.slice(0, 2)), Number(seed.start_time.slice(3))),
      last_status: seed.last_status,
      last_error: seed.error,
      latest_execution: neverRan
        ? null
        : {
            id: `exec-${seed.id}`,
            status: seed.last_status,
            scheduled_for: isoAt(seed.run_offset, Number(seed.start_time.slice(0, 2)), Number(seed.start_time.slice(3))),
            started_at: isoAt(seed.run_offset, Number(seed.start_time.slice(0, 2)), Number(seed.start_time.slice(3))),
            completed_at: isoAt(seed.run_offset, Number(seed.start_time.slice(0, 2)) + 1, 5),
            result_summary: seed.result_summary,
            error: seed.error,
            thread_id: `thread-${seed.task_id}`,
            turn_id: `turn-${seed.task_id}`,
          },
    };
  });
}

/**
 * 审批 fixture：三条 pending、一条 approved（可执行）、一条 approved + browser_action（复制令牌）、
 * 一条 rejected。preview 里带 before/after，审批卡片折叠的 JSON 才有内容可看。
 */
export function buildApprovals(): ApprovalEnvelope[] {
  const envelope = (
    tokenId: string,
    taskId: string,
    operation: string,
    status: "pending" | "approved" | "rejected",
    evidence: string,
    idempotency: string,
    preview: Record<string, unknown>,
    dayOffset: number,
  ): ApprovalEnvelope => ({
    token: {
      token_id: tokenId,
      task_id: taskId,
      operation,
      idempotency_key: idempotency,
      evidence_summary: evidence,
      evidence_digest: `sha256:${idempotency}`,
      issued_at: isoAt(dayOffset, 10, 0),
      expires_at: isoAt(dayOffset + 2, 10, 0),
      status,
      consumed: false,
      consumed_at: null,
    },
    preview: {
      task_id: taskId,
      operation,
      idempotency_key: idempotency,
      evidence_summary: evidence,
      evidence: [{ source: "recruitment_mail", source_ref: "mail-4003", summary: "邮件原文片段" }],
      expires_at: isoAt(dayOffset + 2, 10, 0),
      created_at: isoAt(dayOffset, 10, 0),
      payload: preview,
      before: (preview.__before as Record<string, unknown>) ?? null,
      after: (preview.__after as Record<string, unknown>) ?? null,
      cohort: 2027,
      cohort_status: "confirmed",
      jd_raw: null,
      current_stage: (preview.current_stage as never) ?? null,
      target_stage: (preview.target_stage as never) ?? null,
    },
  });

  return [
    envelope(
      "tok-6001", "task-7001", "application_stage_update", "pending",
      "来自 2027-xx-xx 的米哈游一面邀约邮件，置信度 0.88，与投递 app-2004 唯一匹配。",
      "idem-6001",
      {
        application_id: "app-2004",
        __before: { stage: "written" },
        __after: { stage: "interview1" },
        current_stage: "written",
        target_stage: "interview1",
        source: "recruitment_mail:mail-4003",
      },
      -1,
    ),
    envelope(
      "tok-6002", "task-7002", "schedule_create", "pending",
      "金山办公二面邀约邮件给出「下周三上午 10:00」，但公司名与岗位未同时命中唯一投递。",
      "idem-6002",
      {
        __after: { title: "金山办公 · 二面", event_date: "下周", event_type: "面试" },
        company_name: "金山办公",
        candidate_application_ids: ["app-2005"],
      },
      -1,
    ),
    envelope(
      "tok-6003", "task-7003", "application_note_update", "pending",
      "商汤意向书邮件要求 6 日内答复，需要在投递备注中记录决策截止日期。",
      "idem-6003",
      {
        application_id: "app-2007",
        __before: { note: "已拿到意向书，考虑城市因素。" },
        __after: { note: "意向书已收到，需在答复截止前完成城市与方向对比决策。" },
      },
      0,
    ),
    envelope(
      "tok-6004", "task-7004", "application_stage_update", "approved",
      "华为 HR 面状态由官网进度页读取，已批准，等待人工执行。",
      "idem-6004",
      {
        application_id: "app-2006",
        __before: { stage: "interview2" },
        __after: { stage: "hr" },
        current_stage: "interview2",
        target_stage: "hr",
      },
      -2,
    ),
    envelope(
      "tok-6005", "task-7005", "browser_action", "approved",
      "进度页需要人工验证后才能读取，已批准一次浏览器动作。",
      "idem-6005",
      {
        page_url: "https://careers.huaqin.test/progress/2027",
        action: "read_application_status",
        command_authorized: false,
      },
      -2,
    ),
    envelope(
      "tok-6006", "task-7006", "schedule_create", "rejected",
      "系统识别到两条可能的日期解释，人工判断为证据不足。",
      "idem-6006",
      { __after: { title: "某公司 · 待确认面试", event_type: "面试" }, ambiguous_dates: ["周五", "下周五"] },
      -5,
    ),
  ];
}

/** GET /api/codex/traces —— 前端读 event_type|kind + method|name。 */
const TRACE_SEEDS = [
  ["job_search", "read_only", 42, "discovery"],
  ["company_coverage", "read_only", 61, "reporting"],
  ["schedule_list", "read_only", 25, "reporting"],
  ["application_status_review", "browser_bridge", 1830, "reconciliation"],
  ["recruitment_mail_search", "read_only", 96, "discovery"],
  ["matching_score_read", "read_only", 33, "matching"],
  ["crawl_daily", "write_attempted", 4210, "crawl"],
  ["report_operational", "read_only", 58, "reporting"],
] as const;

export function buildTraces(): CodexTrace[] {
  return TRACE_SEEDS.map(([name, method, latency, phase], index) => ({
    event_type: "tool_call",
    kind: "tool_call",
    method: name,
    name,
    success: method !== "write_attempted",
    latency_ms: latency,
    phase,
    thread_id: `thread-daily-${index}`,
    error_code: method === "write_attempted" ? "approval_required" : undefined,
    metadata: { read_only: method === "read_only" },
  }));
}
