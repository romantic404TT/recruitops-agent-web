/**
 * mock 层的可变内存库。
 *
 * 为什么不是「只读 JSON」：原项目是一个真正的 CRUD 应用 —— 改投递阶段、加日程、
 * 审批决定并执行、停用定时任务、改公司入口地址，全部要能在刷新后仍然成立。
 * 只读 fixture 会让这些写操作「看起来成功、其实没变」。
 * 所以这里持有可变数组，handler 直接改它；页面刷新会重新播种（等价于重启本机服务）。
 */
import { JOB_SEEDS, buildCompanies, toAnalysis, toBrowseItem, toJob } from "./data/jobs";
import { buildApplications, buildSchedule } from "./data/applications";
import { buildMails } from "./data/mails";
import { buildApprovals, buildAutomations, buildTraces } from "./data/ops";
import { buildThreads } from "./data/threads";
import { buildCompanySources } from "./data/companySources";
import { initialConfiguration } from "./data/configuration";
import { isoAt, nextId } from "./data/_clock";
import type {
  Application,
  ApprovalEnvelope,
  Company,
  Job,
  JobAnalysis,
  JobBrowseItem,
  ScheduleEvent,
} from "@/types/domain";
import type { Automation } from "@/types/automation";
import type { CodexThread, CodexTrace } from "@/types/codex";
import type { CompanySourceRecord } from "@/types/companySource";
import type { RecruitmentMail } from "@/types/mail";
import type { ConfigurationReadResponse } from "@/types/configuration";

export interface MockDatabase {
  jobs: Map<string, JobBrowseItem>;
  jobDetails: Map<string, { job: Job; analysis: JobAnalysis | null }>;
  companies: Company[];
  applications: Application[];
  schedule: ScheduleEvent[];
  mails: RecruitmentMail[];
  approvals: ApprovalEnvelope[];
  automations: Automation[];
  threads: CodexThread[];
  traces: CodexTrace[];
  companySources: CompanySourceRecord[];
  configuration: ConfigurationReadResponse;
  /** 邮箱是否已配置：决定 /api/recruitment-mails 走 unavailable 还是正常。 */
  mailConfigured: boolean;
  mailLastSyncAt: string | null;
  /** 定时任务停用后，disable 接口不该再让它回到列表。 */
  lastCrawlReport: unknown | null;
}

function seed(): MockDatabase {
  const jobs = new Map<string, JobBrowseItem>();
  const jobDetails = new Map<string, { job: Job; analysis: JobAnalysis | null }>();
  for (const seedItem of JOB_SEEDS) {
    jobs.set(seedItem.id, toBrowseItem(seedItem));
    jobDetails.set(seedItem.id, { job: toJob(seedItem), analysis: toAnalysis(seedItem) });
  }
  return {
    jobs,
    jobDetails,
    companies: buildCompanies(),
    applications: buildApplications(),
    schedule: buildSchedule(),
    mails: buildMails(),
    approvals: buildApprovals(),
    automations: buildAutomations(),
    threads: buildThreads(),
    traces: buildTraces(),
    companySources: buildCompanySources(),
    configuration: initialConfiguration(),
    mailConfigured: false,
    mailLastSyncAt: null,
    lastCrawlReport: {
      found: true,
      report: {
        run_at: isoAt(0, 3, 42),
        companies_checked: 11,
        new_jobs: 6,
        scored: 5,
        jd_pending: 1,
        failures: [
          { company: "华为", crawler_key: "huawei", type: "detail_page_timeout", message: "职位详情页连续 3 次超时", recommendation: "人工确认入口是否变更" },
          { company: "OPPO", crawler_key: null, type: "human_verification", message: "站点要求人工验证", recommendation: "在浏览器中完成一次验证后重试" },
        ],
      },
    },
  };
}

export const db: MockDatabase = seed();

/** 只用于测试/调试：让 handler 里的新建动作能拿到 id。 */
export { nextId };
