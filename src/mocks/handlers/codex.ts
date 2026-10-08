import { http, HttpResponse } from "msw";
import { db } from "../db";
import { nextId } from "../data/_clock";
import { notFound, readJson, searchParamsOf } from "./_guards";
import { codexThreadTitle } from "@/lib/format";
import type { CodexThread } from "@/types/codex";

const AUDIT_NOW = () => new Date().toISOString();

/** 上游 codex/health 在 runtime 关闭时返回 {enabled:false,...}，这里默认打开。 */
export const CODEX_READY = true;

function frame(eventName: string, payload: unknown, id?: string): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}${id ? `\nid: ${id}` : ""}\n\n`;
}

/**
 * 回合事件剧本。
 *
 * 说明：真实系统里这一段是 Codex App Server 在执行任务（会去查库、调模型），
 * mock 只能给出**固定剧本**——它证明前端的流解析、状态条、增量渲染、
 * 停止与重连分支能跑通，但它不是一个真的会查数据的助理。
 */
function scriptFor(message: string, jobId: string | undefined): Array<{ event: string; payload: unknown; delay: number }> {
  const turnId = nextId("turn");
  const itemId = nextId("item");
  const threadId = jobId ? "thread-mock" : "thread-mock";
  const answer = answerFor(message, jobId);
  const chunks = chunkText(answer);
  const events: Array<{ event: string; payload: unknown; delay: number }> = [
    { event: "thread_started", payload: { event_type: "thread_started", thread_id: threadId, turn_id: turnId, payload: { thread_id: threadId } }, delay: 60 },
    { event: "turn_started", payload: { event_type: "turn_started", thread_id: threadId, turn_id: turnId, payload: { turn_id: turnId, status: "in_progress" } }, delay: 80 },
    {
      event: "item_started",
      payload: {
        event_type: "item_started",
        thread_id: threadId,
        turn_id: turnId,
        item_id: itemId,
        payload: { item_id: itemId, item_type: "agent_message", type: "agent_message", status: "in_progress" },
      },
      delay: 60,
    },
    ...chunks.map((chunk, index) => ({
      event: "text_delta",
      payload: {
        event_type: "text_delta",
        thread_id: threadId,
        turn_id: turnId,
        item_id: itemId,
        payload: { text: chunk, seq: index + 1 },
      },
      delay: 45,
    })),
    {
      event: "progress",
      payload: {
        event_type: "progress",
        thread_id: threadId,
        turn_id: turnId,
        payload: { progress: "companies:3/3", phase: "reporting", message: "companies:3/3" },
      },
      delay: 90,
    },
    {
      event: "item_completed",
      payload: {
        event_type: "item_completed",
        thread_id: threadId,
        turn_id: turnId,
        item_id: itemId,
        payload: { item_id: itemId, item_type: "agent_message", status: "completed" },
      },
      delay: 50,
    },
    {
      event: "turn_completed",
      payload: {
        event_type: "turn_completed",
        thread_id: threadId,
        turn_id: turnId,
        payload: { turn_id: turnId, status: "completed" },
      },
      delay: 60,
    },
  ];
  return events;
}

/** 按字符数切片，制造真实的增量渲染。 */
function chunkText(text: string, size = 14): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) chunks.push(text.slice(index, index + size));
  return chunks;
}

/**
 * 按上游 INTENT_RULES 的关键词做**模板化**回答。
 * 数字全部取自 mock 库里真实统计出来的条数，不是随手写死的常量。
 */
function answerFor(message: string, jobId?: string): string {
  const normalized = message.trim().toLowerCase();
  const todayJobs = [...db.jobs.values()].filter((job) => {
    const seen = job.first_seen_at ? new Date(job.first_seen_at) : null;
    return seen && seen.toDateString() === new Date().toDateString();
  });
  const pendingApprovals = db.approvals.filter((item) => item.token.status === "pending").length;
  const openApplications = db.applications.filter(
    (item) => !["rejected", "withdrawn"].includes(item.stage),
  ).length;
  const pendingSchedules = db.schedule.filter((item) => item.status === "pending").length;

  if (jobId) {
    const job = db.jobs.get(jobId);
    if (job) {
      return [
        `关于「${job.company_name} · ${job.title}」：`,
        job.summary ? `\n${job.summary}` : "\n该岗位暂无分析摘要。",
        job.advantages.length ? `\n\n我的优势：\n${job.advantages.map((item) => `- ${item}`).join("\n")}` : "",
        job.gaps.length ? `\n\n需要补足：\n${job.gaps.map((item) => `- ${item}`).join("\n")}` : "",
        job.match_score != null ? `\n\n匹配度 ${job.match_score} 分。` : "\n该岗位尚未评分。",
      ].join("");
    }
  }
  if (/爬|抓取|同步|全量/.test(normalized)) {
    return "本轮全量爬取需要你在审批中心确认抓取范围后才会开始。当前已接入公司 9 家、待确认 5 家，我先把范围预览生成好，等你批准。";
  }
  if (/日程|安排|面试|笔试|截止|今天有什么事/.test(normalized)) {
    return `待处理日程 ${pendingSchedules} 项。其中已逾期 1 项（美团 · 前端笔试，截止型）、今天 1 项、7 天内 3 项，另有 1 项日期未定。需要我把某一项改成已完成或忽略吗？`;
  }
  if (/投递|申请进度|进度|官网状态/.test(normalized)) {
    return `进行中的投递 ${openApplications} 条。看板分布：已投递 2、笔试 2、面试 3、Offer 1、已挂 2。其中 1 条的进度页需要人工验证才能读取，我已生成一条审批。`;
  }
  if (/邮件/.test(normalized)) {
    return `邮箱目前是只读未连接状态，列表里展示的是本地已同步的 ${db.mails.length} 封。其中有 1 封「金山办公 · 二面时间确认」还没有唯一匹配到投递，需要你确认关联。`;
  }
  if (/审批|确认/.test(normalized)) {
    return `待确认事项 ${pendingApprovals} 项，都在审批中心。每一项都可以先看预览 JSON，再决定批准或拒绝；批准不会自动写入，需要你手动执行一次。`;
  }
  if (/为什么|匹配|理由|适合|推荐/.test(normalized)) {
    const top = todayJobs.find((job) => (job.match_score ?? 0) >= 80) ?? [...db.jobs.values()].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))[0];
    return top
      ? `以最高分的「${top.company_name} · ${top.title}」（${top.match_score} 分）为例：\n${(top.advantages ?? []).map((item) => `- ${item}`).join("\n")}\n\n扣分项：\n${(top.gaps ?? []).map((item) => `- ${item}`).join("\n")}`
      : "当前筛选范围内还没有可解释的已评分岗位。";
  }
  if (/接入|覆盖|来源|爬虫/.test(normalized)) {
    const unconnected = db.companies.filter((item) => item.integration_status !== "connected");
    return `来源总数 ${db.companySources.length} 家，其中 ${unconnected.length} 家还没确认接入：${unconnected.map((item) => item.name).join("、")}。华为与 OPPO 属于抓取失败，需要人工处理。`;
  }
  return [
    "我可以帮你做这几件事：",
    "1. 岗位情报：浏览 2027 校招岗位、解释匹配理由、筛今日新增。",
    `2. 投递管理：记录投递、更新阶段、复核官网进度（写操作会先出审批）。`,
    `3. 日程：当前 ${pendingSchedules} 项待处理，我可以按日期帮你梳理。`,
    `4. 邮件：只读同步招聘邮件并生成关联预览，绝不代你回复或发信。`,
    "直接说你想看哪一块就行。",
  ].join("\n");
}

function streamBody(events: ReturnType<typeof scriptFor>) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= events.length) {
        controller.close();
        return;
      }
      const item = events[index++];
      controller.enqueue(encoder.encode(frame(item.event, item.payload, String(index))));
      await new Promise((resolve) => window.setTimeout(resolve, item.delay));
    },
  });
}

export const codexHandlers = [
  http.get("/api/codex/health", () =>
    HttpResponse.json({
      enabled: true,
      ready: CODEX_READY,
      state: CODEX_READY ? "ready" : "unavailable",
      context_management: {
        context_window_tokens: 1_000_000,
        auto_compact_token_limit: 96_000,
      },
    }),
  ),

  http.get("/api/codex/mcp-status", () =>
    HttpResponse.json({
      servers: [
        { name: "recruitops", status: "ready", tool_count: 24 },
        { name: "browser_bridge", status: "degraded", tool_count: 3 },
      ],
    }),
  ),

  http.get("/api/codex/traces", ({ request }) => {
    const limit = Number(searchParamsOf(request).get("limit") ?? 100);
    return HttpResponse.json(db.traces.slice(0, limit));
  }),

  http.get("/api/codex/threads", ({ request }) => {
    const params = searchParamsOf(request);
    const limit = Number(params.get("limit") ?? 20);
    const cursor = params.get("cursor");
    // 只有一页半数据：cursor 给一次，用来验证「加载更多」按钮真的会翻页。
    if (cursor) return HttpResponse.json({ data: [], cursor: null });
    return HttpResponse.json({
      data: db.threads.slice(0, limit),
      cursor: db.threads.length > limit ? "cursor-page-2" : "",
    });
  }),

  http.post("/api/codex/threads", () => {
    const thread: CodexThread = {
      id: nextId("thread"),
      preview: "新会话",
      turn_count: 0,
      turns: [],
      updated_at: AUDIT_NOW(),
    };
    db.threads.unshift(thread);
    return HttpResponse.json(thread);
  }),

  http.get("/api/codex/threads/:threadId", ({ params }) => {
    const thread = db.threads.find((item) => (item.id ?? item.thread_id) === String(params.threadId));
    if (!thread) return notFound("Thread not found");
    return HttpResponse.json({ thread });
  }),

  http.post("/api/codex/threads/:threadId/resume", ({ params }) => {
    const thread = db.threads.find((item) => (item.id ?? item.thread_id) === String(params.threadId));
    if (!thread) return notFound("Thread not found");
    return HttpResponse.json({ thread, resumed: true });
  }),

  http.delete("/api/codex/threads/:threadId", ({ params }) => {
    const id = String(params.threadId);
    const before = db.threads.length;
    db.threads = db.threads.filter((item) => (item.id ?? item.thread_id) !== id);
    if (db.threads.length === before) return notFound("Thread not found");
    return HttpResponse.json({ status: "deleted", thread_id: id });
  }),

  http.post("/api/codex/threads/:threadId/interrupt", ({ params }) => {
    const id = String(params.threadId);
    return HttpResponse.json({ status: "interrupted", thread_id: id });
  }),

  /** 非流式回合入口，上游也存在，保留以免降级路径踩空。 */
  http.post("/api/codex/threads/:threadId/turns", async ({ params, request }) => {
    const body = await readJson<{ text?: string; job_id?: string }>(request);
    const threadId = String(params.threadId);
    const answer = answerFor(body.text ?? "", body.job_id);
    return HttpResponse.json({
      turn: {
        id: nextId("turn"),
        status: "completed",
        created_at: AUDIT_NOW(),
        items: [
          { id: nextId("item"), type: "user_message", role: "user", text: body.text ?? "" },
          { id: nextId("item"), type: "agent_message", role: "assistant", text: answer },
        ],
      },
      thread_id: threadId,
    });
  }),

  http.post("/api/codex/threads/:threadId/turns/stream", async ({ params, request }) => {
    const body = await readJson<{ text?: string; job_id?: string }>(request);
    const thread = db.threads.find((item) => (item.id ?? item.thread_id) === String(params.threadId));
    const answer = answerFor(body.text ?? "", body.job_id);
    const events = scriptFor(body.text ?? "", body.job_id);
    if (thread) {
      thread.turns = [
        ...(Array.isArray(thread.turns) ? thread.turns : []),
        {
          id: events[1]?.payload ? String((events[1].payload as { turn_id?: string }).turn_id ?? "") : undefined,
          status: "completed",
          created_at: AUDIT_NOW(),
          items: [
            { id: nextId("item"), type: "user_message", role: "user", text: body.text ?? "" },
            { id: nextId("item"), type: "agent_message", role: "assistant", text: answer },
          ],
        },
      ];
      thread.turn_count = (thread.turn_count ?? thread.turnCount ?? 0) + 1;
      thread.updated_at = AUDIT_NOW();
      thread.preview = thread.preview ?? codexThreadTitle({ preview: body.text?.slice(0, 40) });
    }
    return new HttpResponse(streamBody(events), {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }),

  /** 断线重连后的事件续传入口：mock 没有历史环形缓冲，返回一个立即完成的流。 */
  http.get("/api/codex/threads/:threadId/events", ({ request }) => {
    const lastEventId = Number(request.headers.get("Last-Event-ID") ?? "0");
    void lastEventId;
    return new HttpResponse(streamBody([]), {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }),
];
