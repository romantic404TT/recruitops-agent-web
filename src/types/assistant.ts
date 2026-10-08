/**
 * 会话与本地任务记录。这两个结构完全由前端自己造（上游没有对应的后端表），
 * 走 localStorage 持久化，所以类型也在这里定义，而不是 domain.ts。
 */
import type { ISODateTime } from "./domain";

/** app.js:3531 rememberTask —— 上限 30 条。 */
export interface LocalTask extends Record<string, unknown> {
  local_task_id: string;
  task_id?: string | null;
  task_type: string;
  status: string;
  user_request?: string;
  display_label?: string;
  steps?: number;
  plan?: string[];
  result?: unknown;
  citations?: unknown[];
  error?: string;
  /** true 表示这条记录来自本地预览，服务端没有对应任务。 */
  local_preview?: boolean;
  created_at?: ISODateTime;
}

/** app.js codexHistoryMessages / renderMessageRecord —— 消息壳。 */
export interface MessageRecord {
  id: string;
  role: "user" | "assistant";
  body: string;
  created_at?: ISODateTime;
  task_id?: string | null;
  result?: LocalTask | null;
  streaming?: boolean;
}

/** 落盘结构：上游 persistConversation（app.js:460 附近）只保留最近 60 条消息、30 条任务。 */
export interface PersistedConversation {
  version: 1;
  codexThreadId: string | null;
  messages: MessageRecord[];
  tasks: LocalTask[];
}

export const PERSIST_MESSAGE_LIMIT = 60;
export const PERSIST_TASK_LIMIT = 30;

/** 首页快捷入口（index.html:579-585）。 */
export interface QuickQuestion {
  task: string;
  question: string;
  label: string;
  hint: string;
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    task: "full_recruitment_sync",
    question:
      "立即在后台执行一次全量岗位爬取，包括公司发现、岗位抓取、职位详情补全和匹配评分",
    label: "全量爬取",
    hint: "公司发现、岗位抓取与评分",
  },
  {
    task: "today_new_jobs",
    question: "查看今日新增岗位",
    label: "今日岗位",
    hint: "已确认 2027 校招",
  },
  {
    task: "recruitment_mail_process",
    question:
      "处理全部待处理的招聘邮件，识别笔试、面试、Offer 和其他待办信息，并按照安全规则更新投递进度和日程",
    label: "处理邮件信息",
    hint: "同步邮件并整理求职进度",
  },
  {
    task: "application_status_review",
    question: "复核官网投递状态",
    label: "投递进度",
    hint: "官网状态核验",
  },
  {
    task: "today_schedule",
    question: "查看今天的笔试和面试安排",
    label: "今日日程",
    hint: "笔试、面试与截止",
  },
];
