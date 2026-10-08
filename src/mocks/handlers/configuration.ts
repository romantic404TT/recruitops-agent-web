import { http, HttpResponse } from "msw";
import { db } from "../db";
import { notFound, readJson, requireLocalUi } from "./_guards";
import { degreeOption, splitLines } from "@/stores/configuration";
import type { ConfigurationSaveBody, ModelConnection } from "@/types/configuration";

const AUDIT_NOW = () => new Date().toISOString();

/** 上游对简历大小的限制（configuration.js 的界面提示是 10 MB）。 */
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

function applyOnboarding() {
  const config = db.configuration;
  const active = config.model_connections.find(
    (item) => item.id === config.active_model_connection_id,
  );
  const modelReady = Boolean(
    active?.base_url && active?.model && (active.api_key || active.key_configured),
  );
  const keywords = config.profile.matching?.title_keywords ?? [];
  const groups = config.profile.scope?.industry_groups ?? [];
  const messages: Record<string, string> = {};
  if (!modelReady) messages.model_connection = "尚未配置可用的模型连接：请填写服务地址、模型名称与 API 密钥。";
  if (!keywords.length) messages.title_keywords = "岗位筛选关键词为空，抓取将无法判断保留哪些岗位。";
  if (!groups.length) messages.industry_groups = "至少选择一个行业大类。";
  if (!config.profile.degree) messages.degree = "学历影响岗位的学历门槛判断，请补充。";
  config.onboarding = { ready: modelReady && keywords.length > 0 && groups.length > 0, messages };
  config.module_readiness = {
    assistant: { status: modelReady ? "configured" : "missing_model" },
    job_scoring: { ready: modelReady },
    scheduled_tasks: { ready: true },
  };
  config.configured_capabilities = {
    llm_enabled: config.settings.llm_enabled === true,
    codex_runtime_enabled: config.settings.codex_runtime_enabled === true,
    vision_enabled: config.settings.vision_enabled === true,
  };
}

export const configurationHandlers = [
  http.post("/api/local-ui/configuration/read", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    applyOnboarding();
    return HttpResponse.json(db.configuration);
  }),

  http.post("/api/local-ui/configuration/save", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<ConfigurationSaveBody>(request);
    const config = db.configuration;
    const changed: string[] = [];

    if (body.settings) {
      for (const [key, value] of Object.entries(body.settings)) {
        if (String(config.settings[key]) !== String(value)) changed.push(`settings.${key}`);
        config.settings[key] = value;
      }
    }
    if (body.profile) {
      config.profile = { ...config.profile, ...body.profile };
      changed.push("profile");
    }
    if (body.model_connections) {
      if (body.model_connections.length > 8) {
        return HttpResponse.json({ detail: "最多保留 8 个模型连接" }, { status: 422 });
      }
      config.model_connections = body.model_connections.map((item: ModelConnection) => {
        const previous = config.model_connections.find((old) => old.id === item.id);
        const next = { ...item };
        // 密钥留空表示「保留已存的」，绝不能用空串覆盖掉 key_configured。
        if (!next.api_key) {
          next.api_key = undefined;
          next.key_configured = previous?.key_configured ?? false;
        } else {
          next.key_configured = true;
        }
        return next;
      });
      changed.push("model_connections");
    }
    if (body.active_model_connection_id) {
      config.active_model_connection_id = body.active_model_connection_id;
      changed.push("active_model_connection_id");
    }
    // 邮箱：用户名与服务器都填了才算配置，密码留空表示保留原密钥。
    const mailUser = String(config.settings.mail_imap_username ?? "").trim();
    const mailHost = String(config.settings.mail_imap_host ?? "").trim();
    const keepSecret = config.secrets.mail_imap_password;
    if (mailUser && mailHost) {
      if (!keepSecret) config.secrets.mail_imap_password = true;
      db.mailConfigured = true;
      db.mailLastSyncAt = AUDIT_NOW();
    } else {
      db.mailConfigured = false;
    }
    if (body.complete_onboarding) {
      applyOnboarding();
      if (!config.onboarding?.ready) {
        return HttpResponse.json(
          { detail: "首次配置尚未完成，请补齐模型连接、岗位关键词与行业范围。" },
          { status: 422 },
        );
      }
    }
    applyOnboarding();
    return HttpResponse.json({
      message: changed.length ? `已保存：${changed.join("、")}。重启本地服务后完全生效。` : "没有需要保存的改动。",
      changed,
      restart_required: true,
      onboarding: config.onboarding,
    });
  }),

  http.post("/api/local-ui/configuration/model/test", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<Record<string, unknown>>(request);
    const connection =
      (db.configuration.model_connections.find(
        (item) => item.id === body.connection_id,
      ) as unknown as Record<string, unknown>) ?? body;
    const baseUrl = String(connection.base_url ?? "").trim();
    const model = String(connection.model ?? "").trim();
    const apiKey = String(connection.api_key ?? "").trim();
    const keyConfigured = Boolean(connection.key_configured);
    if (!/^https?:\/\//i.test(baseUrl)) {
      return HttpResponse.json({ ok: false, status: "invalid", message: "服务地址必须以 http:// 或 https:// 开头。" });
    }
    if (!model) {
      return HttpResponse.json({ ok: false, status: "invalid", message: "请填写模型名称。" });
    }
    if (!apiKey && !keyConfigured) {
      return HttpResponse.json({ ok: false, status: "missing_key", message: "缺少 API 密钥：请填写密钥，或先保存一个已配置密钥的连接。" });
    }
    return HttpResponse.json({
      ok: true,
      status: "configured",
      message: "鉴权、模型名称、结构化输出与助理接口均通过。",
      checks: { auth: true, model: true, structured_output: true, assistant_api: true },
      latency_ms: 420,
    });
  }),

  http.post("/api/local-ui/configuration/mail/test", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<Record<string, unknown>>(request);
    const host = String(body.mail_imap_host ?? "").trim();
    const username = String(body.mail_imap_username ?? "").trim();
    const password = String(body.mail_imap_password ?? "").trim();
    if (!host || !username) {
      return HttpResponse.json({ ok: false, message: "请填写 IMAP 服务器与邮箱账号。" });
    }
    if (!password && !db.configuration.secrets.mail_imap_password) {
      return HttpResponse.json({ ok: false, message: "请填写邮箱授权码；它不是网页登录密码。" });
    }
    db.mailConfigured = true;
    db.configuration.secrets.mail_imap_password = true;
    db.mailLastSyncAt = AUDIT_NOW();
    return HttpResponse.json({
      ok: true,
      message: "连接成功，已读取 INBOX。",
      folders: ["INBOX"],
      mailbox: String(body.mail_imap_mailbox ?? "INBOX") || "INBOX",
    });
  }),

  http.post("/api/local-ui/configuration/resume", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<{ profile?: Record<string, unknown> }>(request);
    if (body.profile) {
      db.configuration.profile = { ...db.configuration.profile, ...body.profile };
      applyOnboarding();
    }
    return HttpResponse.json({ message: "简历资料已保存。", degree: degreeOption(db.configuration.profile.degree) });
  }),

  /** 简历解析：不接模型，从上传的文本里抽信息，因此结果会随文件内容变化。 */
  http.post("/api/local-ui/configuration/resume/parse", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<{ filename?: string; content?: string }>(request);
    const content = String(body.content ?? "");
    if (!content.trim()) {
      return HttpResponse.json({ detail: "简历内容为空或不是可读文本，请改传文字版 PDF、TXT 或 Markdown。" }, { status: 422 });
    }
    if (content.length > MAX_RESUME_BYTES) {
      return HttpResponse.json({ detail: "简历超过 10 MB 上限。" }, { status: 413 });
    }
    const lower = content.toLowerCase();
    const verified = ["go", "golang", "c++", "python", "java", "rust", "sql", "mysql", "redis", "kafka"]
      .filter((token) => lower.includes(token))
      .map((token) => (token === "golang" ? "Go" : token === "sql" ? "SQL" : token === "c++" ? "C++" : token[0].toUpperCase() + token.slice(1)));
    const supporting = ["docker", "kubernetes", "grpc", "clickhouse", "spark", "hadoop", "flink", "react", "typescript"]
      .filter((token) => lower.includes(token))
      .map((token) => token[0].toUpperCase() + token.slice(1));
    const projectLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 12 && /项目|实习|负责|实现|设计|优化|搭建/.test(line))
      .slice(0, 5);
    const keywords = [...new Set(["后端", "服务端", "基础架构", "平台", "数据"] .filter((word) => content.includes(word)))];

    return HttpResponse.json({
      filename: body.filename ?? "resume",
      degree: degreeOption(content.match(/(博士|硕士|研究生|本科)/)?.[0] ?? ""),
      skills: verified.length ? verified : ["（未从原文识别到明确技能词）"],
      stack: supporting,
      projects: projectLines.length ? projectLines : ["（未识别到项目段落，请检查简历是否为文字版）"],
      title_keywords: keywords,
      evidence: projectLines.join("\n"),
      warnings: verified.length ? [] : ["没有识别到技能关键词：如果简历是图片或扫描件，请改传文字版。"],
    });
  }),

  http.post("/api/local-ui/configuration/applications/import", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    const body = await readJson<{ format?: string; content?: string; filename?: string }>(request);
    const content = String(body.content ?? "");
    if (!content.trim()) {
      return HttpResponse.json({ detail: "文件内容为空。" }, { status: 422 });
    }
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    if (body.format === "json" || content.trim().startsWith("[")) {
      let rows: unknown;
      try {
        rows = JSON.parse(content);
      } catch (error) {
        return HttpResponse.json({ detail: `JSON 解析失败：${(error as Error).message}` }, { status: 422 });
      }
      if (!Array.isArray(rows)) return HttpResponse.json({ detail: "JSON 顶层必须是数组。" }, { status: 422 });
      for (const raw of rows) {
        const row = raw as Record<string, unknown>;
        if (!row.company_name || !row.job_title) {
          skipped += 1;
          errors.push(`缺少 company_name 或 job_title：${JSON.stringify(row).slice(0, 60)}`);
          continue;
        }
        const duplicated = db.applications.some(
          (item) => item.company_name === row.company_name && item.job_title === row.job_title,
        );
        if (duplicated) {
          skipped += 1;
          continue;
        }
        db.applications.push({
          id: `app-${Date.now()}-${inserted}`,
          company_name: String(row.company_name),
          job_title: String(row.job_title),
          job_id: null,
          record_url: (row.record_url as string) ?? null,
          stage: (row.stage as never) ?? "applied",
          idempotency_key: `import-${Date.now()}-${inserted}`,
          note: (row.note as string) ?? null,
          stage_history: [],
          source_stage: null,
          source_status: null,
          source_status_synced_at: null,
          created_at: AUDIT_NOW(),
          updated_at: AUDIT_NOW(),
          source: "csv_import",
          source_ref: body.filename ?? "import",
        });
        inserted += 1;
      }
    } else {
      const lines = splitLines(content);
      const header = (lines[0] ?? "").split(",").map((cell) => cell.trim());
      const indexOf = (name: string) => header.indexOf(name);
      if (indexOf("company_name") === -1 || indexOf("job_title") === -1) {
        return HttpResponse.json({ detail: "CSV 表头必须包含 company_name 与 job_title。" }, { status: 422 });
      }
      for (const line of lines.slice(1)) {
        const cells = line.split(",");
        const company = (cells[indexOf("company_name")] ?? "").trim();
        const title = (cells[indexOf("job_title")] ?? "").trim();
        if (!company || !title) {
          skipped += 1;
          continue;
        }
        db.applications.push({
          id: `app-${Date.now()}-${inserted}`,
          company_name: company,
          job_title: title,
          job_id: null,
          record_url: null,
          stage: "applied",
          idempotency_key: `import-${Date.now()}-${inserted}`,
          note: null,
          stage_history: [],
          source_stage: null,
          source_status: null,
          source_status_synced_at: null,
          created_at: AUDIT_NOW(),
          updated_at: AUDIT_NOW(),
          source: "csv_import",
          source_ref: body.filename ?? "import",
        });
        inserted += 1;
      }
    }
    return HttpResponse.json({
      inserted,
      skipped,
      errors,
      message: `导入完成：新增 ${inserted} 条，跳过 ${skipped} 条。`,
    });
  }),

  http.post("/api/local-ui/configuration/latest-crawl", async ({ request }) => {
    const blocked = requireLocalUi(request);
    if (blocked) return blocked;
    return HttpResponse.json(db.lastCrawlReport ?? { found: false, report: null });
  }),

  http.get("/api/local-ui/configuration/*", () =>
    notFound("Configuration endpoints are POST-only"),
  ),
];
