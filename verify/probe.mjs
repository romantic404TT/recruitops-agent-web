// 验收探针：用本机已缓存的 playwright-core 驱动无头 Edge，逐路由取证。
// 放在 verify/（gitignore 掉 out/），不参与 tsc / vite build。
import { chromium } from "file:///C:/Users/Lenovo/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://127.0.0.1:5330";
const OUT = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const PROFILE = "C:/Users/Lenovo/AppData/Local/Temp/ro-verify-profile";

const ROUTES = [
  ["jobs", "/jobs", "table.jobs-table tbody tr"],
  ["dashboard", "/dashboard", ".todo-card"],
  ["companies", "/companies", "table.company-ranking-table tbody tr"],
  ["applications", "/applications", ".application-card"],
  ["schedule", "/schedule", ".schedule-item"],
  ["automations", "/automations", ".automation-item"],
  ["mail", "/mail", ".mail-row"],
  ["approvals", "/approvals", ".approval-card"],
  ["tasks", "/tasks", ".trace-row"],
  ["integrations", "/integrations", "#company-sources-section table tbody tr"],
  ["assistant", "/assistant", ".command-button"],
  ["configuration", "/configuration", ".model-connection"],
];

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  viewport: { width: 1440, height: 900 },
});

for (const [name, path, selector] of ROUTES) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 140)}`);
  });
  let count = 0;
  let title = "";
  let heading = "";
  try {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForSelector(selector, { timeout: 15000 }).catch(() => {});
    count = await page.locator(selector).count();
    title = await page.title();
    heading = (await page.locator(".view-panel.is-visible h2").first().innerText().catch(() => "(无标题)")).replace(/\n/g, " ");
    await page.screenshot({ path: `${OUT}${name}.png` });
  } catch (error) {
    errors.push(`goto: ${error.message.split("\n")[0]}`);
  }
  console.log(JSON.stringify({ route: path, selectorHits: count, title, heading, errors: errors.slice(0, 3) }));
  await page.close();
}

const page = await context.newPage();
await page.goto(`${BASE}/jobs`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const api = await page.evaluate(async () => {
  const get = async (url) => {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => null);
    return {
      status: response.status,
      keys: body && typeof body === "object" ? Object.keys(body).slice(0, 8) : null,
      total: body?.total ?? body?.items?.length ?? (Array.isArray(body) ? body.length : undefined),
    };
  };
  const post = async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-RecruitOps-Local-UI": "1" },
      body: "{}",
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, keys: Object.keys(body ?? {}).slice(0, 10) };
  };
  return {
    health: await get("/health"),
    browse: await get("/api/jobs/browse?limit=5&offset=0&sort=score"),
    jobDetail: await get("/api/jobs/job-1001"),
    companies: await get("/api/companies"),
    applications: await get("/api/applications/page?limit=200&offset=0"),
    schedule: await get("/api/schedule"),
    automations: await get("/api/automations"),
    mails: await get("/api/recruitment-mails?limit=50"),
    approvals: await get("/api/approvals"),
    traces: await get("/api/codex/traces"),
    codexHealth: await get("/api/codex/health"),
    threads: await get("/api/codex/threads?limit=20"),
    companySources: await get("/api/company-sources?page=1&page_size=30&q="),
    operational: await get("/api/reports/operational?on=2026-09-24"),
    configRead: await post("/api/local-ui/configuration/read"),
    latestCrawl: await post("/api/local-ui/configuration/latest-crawl"),
    guardNoHeader: await (async () => {
      const response = await fetch("/api/local-ui/applications/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: "探针", job_title: "探针岗" }),
      });
      return { status: response.status, detail: (await response.json().catch(() => null))?.detail };
    })(),
  };
});
console.log("=== 接口直连（在页面内 fetch，经过 MSW service worker） ===");
console.log(JSON.stringify(api, null, 1));

await context.close();
