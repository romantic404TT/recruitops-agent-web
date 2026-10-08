/**
 * 全部文案常量，逐条对照上游 `apps/web/app.js` 的常量区（行号见各段落注释）。
 * 集中在这里是为了避免中文标签散落到组件里被改写。
 */
import type { ApplicationStage } from "@/types/domain";

/** app.js:104 —— 上游 localStorage 键名，复刻版沿用同名，便于同域迁移。 */
export const STORAGE_KEYS = {
  codexThread: "recruitops.assistant.codex_thread_id",
  recent: "recruitops.assistant.recent.v1",
} as const;

/** app.js:8 —— 这些键的值绝不写入本地会话。 */
export const STORAGE_SECRET_KEYS =
  /^(api_token|authorization|bearer_token|access_token|client_secret|password|secret)$/i;

/** app.js:9 —— 这些键落盘时替换成占位串（正文太长）。 */
export const STORAGE_BULKY_KEYS = /^(jd_raw|raw_html|page_text|body_html)$/i;

export const LOCAL_SCHEDULE_EVENTS_URL = "/api/local-ui/events";

/** app.js:110 */
export const TASK_LABELS: Record<string, string> = {
  conversation: "直接回答",
  capabilities: "能力说明",
  today_schedule: "今日安排",
  today_new_jobs: "今日岗位",
  company_coverage: "公司接入",
  knowledge_search: "接入知识检索",
  application_query: "投递状态",
  application_status_review: "投递进度复核",
  recommendation_explanation: "岗位匹配解释",
  application_preview: "投递预览",
  recruitment_mail_search: "招聘邮件",
  recruitment_mail_detail: "邮件详情",
  recruitment_mail_review: "邮件关联复核",
  recruitment_mail_process: "处理邮件信息",
  full_recruitment_sync: "全量爬取",
  operation_run: "手动运营任务",
  automation_plan: "定时计划预览",
};

/** app.js:130 */
export const STATUS_LABELS: Record<string, string> = {
  success: "已完成",
  succeeded: "已完成",
  no_results: "没有结果",
  ambiguous: "需要确认",
  failure: "执行失败",
  safe_stop: "已安全停止",
  stopped: "已停止",
  retrying: "重试中",
  planned: "已规划",
  tool_completed: "工具已返回",
  preview: "只读预览",
};

/** app.js:144 */
export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  interested: "关注",
  applied: "已投递",
  assessment: "测评",
  written: "笔试",
  interview1: "一面",
  interview2: "二面",
  interview3: "三面",
  hr: "HR 面",
  offer: "Offer",
  rejected: "已结束",
  withdrawn: "已撤回",
};

export const APPLICATION_STAGE_ORDER = Object.keys(
  APPLICATION_STAGE_LABELS,
) as ApplicationStage[];

/** app.js:158 —— 看板 5 列，列由 stage 归属决定，卡面只显示结果。 */
export interface ApplicationColumn {
  key: "applied" | "written" | "interview" | "offer" | "closed";
  label: string;
  stages: ApplicationStage[];
}

export const APPLICATION_COLUMNS: ApplicationColumn[] = [
  { key: "applied", label: "已投递", stages: ["interested", "applied"] },
  { key: "written", label: "笔试", stages: ["assessment", "written"] },
  { key: "interview", label: "面试", stages: ["interview1", "interview2", "interview3", "hr"] },
  { key: "offer", label: "Offer", stages: ["offer"] },
  { key: "closed", label: "已挂", stages: ["rejected", "withdrawn"] },
];

/** app.js:169 —— 上游注释明确写了「刻意做成确定性的」：UI 先选任务类型再发请求。 */
export interface IntentRule {
  taskType: string;
  label: string;
  terms: string[];
}

export const INTENT_RULES: IntentRule[] = [
  { taskType: "automation_plan", label: "定时计划预览", terms: ["制定定时任务", "定时计划", "安排每天", "每天凌晨", "每日凌晨", "每天更新", "每日更新"] },
  { taskType: "full_recruitment_sync", label: "全量爬取", terms: ["全量爬取", "全量抓取", "运行每日抓取", "运行每日招聘情报", "执行每日招聘情报"] },
  { taskType: "operation_run", label: "手动运营任务", terms: ["运行爬虫健康", "同步招聘邮箱", "邮箱同步", "运行投递进度任务", "执行投递复核任务"] },
  { taskType: "recommendation_explanation", label: "岗位匹配解释", terms: ["为什么匹配", "匹配原因", "适合我", "岗位匹配", "解释岗位", "推荐理由"] },
  { taskType: "application_status_review", label: "投递进度复核", terms: ["复核投递", "检查投递", "同步投递", "更新投递", "更新申请", "岗位状态", "官网状态"] },
  { taskType: "recruitment_mail_process", label: "处理邮件信息", terms: ["处理邮件信息", "处理招聘邮件", "整理招聘邮件", "处理全部待处理邮件"] },
  { taskType: "recruitment_mail_review", label: "邮件关联复核", terms: ["复核邮件", "关联邮件", "邮件关联"] },
  { taskType: "recruitment_mail_search", label: "招聘邮件", terms: ["招聘邮件", "邮箱消息", "企业邮件", "offer 邮件"] },
  { taskType: "application_query", label: "投递状态", terms: ["投递", "申请进度", "投递进度", "申请状态", "已投", "投了哪些"] },
  { taskType: "knowledge_search", label: "接入知识检索", terms: ["爬虫经验", "接入经验", "历史方案", "ats"] },
  { taskType: "company_coverage", label: "公司接入", terms: ["接入", "招聘来源", "招聘网站", "爬虫", "覆盖哪些公司"] },
  { taskType: "today_schedule", label: "今日安排", terms: ["安排", "日程", "面试", "笔试", "截止", "今天有什么事"] },
  { taskType: "today_new_jobs", label: "今日岗位", terms: ["岗位", "职位", "招聘", "机会", "值得看", "新增", "推荐岗位"] },
];

/** app.js:189 */
export const DEFAULT_QUESTIONS: Record<string, string> = {
  today_schedule: "查看今天的笔试和面试安排",
  today_new_jobs: "查看今日新增岗位",
  company_coverage: "哪些公司还没有接入？",
  application_query: "查询我的投递进度",
  application_status_review: "复核官网投递状态",
  recommendation_explanation: "请解释这个岗位为什么匹配我",
  full_recruitment_sync:
    "立即在后台执行一次全量岗位爬取，包括公司发现、岗位抓取、职位详情补全和匹配评分",
  recruitment_mail_process:
    "处理全部待处理的招聘邮件，并按照安全规则更新投递进度和日程",
};

/** app.js:225 */
export const RUNTIME_STAGE_LABELS: Record<string, string> = {
  starting: "准备任务",
  scope_pending: "准备抓取范围",
  scope_frozen: "抓取范围已确认",
  discovery: "公司发现",
  reconciliation: "公司整理",
  companies: "岗位抓取",
  details: "职位详情补全",
  crawl: "岗位抓取",
  matching: "岗位评分",
  offline_reconciliation: "岗位状态整理",
  reporting: "生成结果",
};

/** app.js:903 */
export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  completed: "已完成",
  ignored: "已忽略",
};

/** app.js:909 */
export const SCHEDULE_TIME_KIND_LABELS: Record<string, string> = {
  appointment: "约定事项",
  deadline: "截止提醒",
  unspecified: "时间未定",
};

/** app.js:915 */
export const SCHEDULE_DUE_GROUPS: Array<{ key: "overdue" | "soon" | "other"; label: string }> = [
  { key: "overdue", label: "逾期" },
  { key: "soon", label: "即将到期" },
  { key: "other", label: "其他" },
];

/** app.js:2101 */
export const AUTOMATION_STATUS_LABELS: Record<string, string> = {
  running: "执行中",
  succeeded: "最近成功",
  failed: "最近失败",
  blocked: "需要处理",
};

/** app.js:2290 */
export const MAIL_CATEGORY_LABELS: Record<string, string> = {
  application_confirmation: "投递确认",
  assessment: "测评",
  written_test: "笔试",
  interview: "面试",
  offer: "Offer",
  rejection: "拒信",
  other: "其他",
};

/** app.js:2300 */
export const MAIL_PROCESSING_STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  processed_updated: "已更新投递阶段",
  processed_unchanged: "已核对，无变化",
  processed: "已处理",
  irrelevant: "非招聘邮件",
  pending_association: "待关联",
  failed: "处理失败",
  needs_confirmation: "待人工确认",
  linked: "已关联",
  ignored: "已忽略",
};

/** app.js:2313 */
export const MAIL_FRESHNESS_STATUSES = new Set(["synced", "cached", "failed", "disabled"]);

/** app.js:3179 */
export const CONTEXT_LABELS: Record<string, string> = {
  job_id: "岗位",
  job_title: "岗位名称",
  company_id: "公司",
  company_name: "公司",
  city: "城市",
  min_score: "最低匹配",
  query: "筛选",
  last_task_type: "最近任务",
  application_id: "投递记录",
};

/** app.js:508 —— Codex 事件状态条的 6 个格子。 */
export const CODEX_STATUS_KEYS = ["thread", "turn", "item", "tool", "progress", "error"] as const;
export type CodexStatusKey = (typeof CODEX_STATUS_KEYS)[number];

export const CODEX_STATUS_LABELS: Record<CodexStatusKey, string> = {
  thread: "会话",
  turn: "轮次",
  item: "步骤",
  tool: "工具",
  progress: "进度",
  error: "错误",
};

/** app.js:166 */
export const CODEX_STREAM_MAX_RECONNECTS = 2;

/** app.js:249 —— 只放行这三种协议，其余链接按纯文本渲染。 */
export const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** app.js:210 —— 上游把三条 Codex 运行时限英文原文改写成中文说明。 */
export function localizeCodexRuntimeMessage(value: unknown): string {
  const raw = String(value ?? "");
  return raw
    .replace(
      /Codex turn interrupted after reaching the runtime time limit\.?/gi,
      "本次对话回合达到运行时限并已结束；已经启动的后台任务不会因此自动取消，可以直接询问最近任务的进度。中断前已经完成的写入会保留。",
    )
    .replace(
      /Codex turn interrupted after reaching the tool-call budget\.?/gi,
      "本次任务达到工具调用次数上限，已被运行时中断；中断前已经完成的写入会保留。",
    )
    .replace(
      /Codex turn interrupted after repeated events without progress\.?/gi,
      "本次任务连续多次没有产生新进展，已被运行时中断；中断前已经完成的写入会保留。",
    );
}

/** app.js:238 */
export function friendlyRuntimeProgress(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "处理中";
  const [stage, detail = ""] = raw.split(":", 2);
  const label = RUNTIME_STAGE_LABELS[stage];
  if (!label) return raw;
  const count = /^\d+\/\d+$/.test(detail) ? detail : undefined;
  return count ? `${label} ${count}` : label;
}

/** 侧边栏 12 个视图的中文名与 eyebrow 文案（index.html 内联）。 */
export const VIEW_TITLES: Record<string, { title: string; eyebrow: string }> = {
  configuration: { title: "个人配置", eyebrow: "配置 / 本机" },
  jobs: { title: "27届校招", eyebrow: "岗位 / 2027 届" },
  companies: { title: "公司", eyebrow: "2027 届岗位覆盖" },
  assistant: { title: "求职助理", eyebrow: "对话 / Codex" },
  applications: { title: "投递记录", eyebrow: "我的 / 投递" },
  schedule: { title: "日程安排", eyebrow: "笔试、面试与截止" },
  automations: { title: "定时任务", eyebrow: "本机持久化计划" },
  mail: { title: "招聘邮箱", eyebrow: "只读邮件情报" },
  approvals: { title: "审批中心", eyebrow: "人工确认边界" },
  tasks: { title: "任务轨迹", eyebrow: "可追溯执行" },
  integrations: { title: "数据接入", eyebrow: "系统维护" },
  dashboard: { title: "今日工作台", eyebrow: "今天要处理的事情" },
};
