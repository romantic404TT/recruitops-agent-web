import { create } from "zustand";
import { api } from "@/lib/http";
import { localDate, visibleJobs } from "@/lib/format";
import { useJobsStore } from "./jobs";
import { useCompaniesStore } from "./companies";
import { useApplicationsStore } from "./applications";
import { useScheduleStore } from "./schedule";
import { useAutomationsStore } from "./automations";
import { useMailsStore } from "./mails";
import { useApprovalsStore } from "./approvals";
import { useTasksStore } from "./tasks";
import { useAssistantStore } from "./assistant";
import { setNavCounts } from "./navCounts";
import { showToast } from "./toast";
import type { OperationalReport, ServiceStatus } from "@/types/domain";
import type { CodexHealth } from "@/types/codex";

export type ConnectionState = "loading" | "ready" | "error";

interface SystemState {
  status: ConnectionState;
  statusText: string;
  todayLabel: string;
  lastSyncLabel: string;
  dashboardSummary: string;
  health: ServiceStatus | null;
  operationalReport: OperationalReport | null;
  bootstrapping: boolean;
  bootstrapError: string;
  metrics: {
    newJobs: number;
    newJobsDetail: string;
    schedule: number;
    scheduleDetail: string;
    anomalies: number;
    anomaliesDetail: string;
    approvals: number;
    approvalsDetail: string;
  };
  boot: () => Promise<void>;
  refreshBusinessData: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const today = localDate();

export const useSystemStore = create<SystemState>((set, get) => ({
  status: "loading",
  statusText: "连接中",
  todayLabel: "—",
  lastSyncLabel: "尚未同步",
  dashboardSummary: "正在读取招聘数据与审批状态",
  health: null,
  operationalReport: null,
  bootstrapping: false,
  bootstrapError: "",
  metrics: {
    newJobs: 0,
    newJobsDetail: "加载中",
    schedule: 0,
    scheduleDetail: "加载中",
    anomalies: 0,
    anomaliesDetail: "等待检查",
    approvals: 0,
    approvalsDetail: "加载中",
  },

  /**
   * 上游 loadCore()（app.js:4150）：9 个请求并发，其中 codex/health、邮件、
   * 运营报告三者失败可降级，其余任一失败整页判 error。这里保持同样的分组。
   */
  boot: async () => {
    set({ status: "loading", statusText: "连接中", bootstrapping: true, bootstrapError: "" });
    try {
      const [health, codexHealth, schedule, jobs, companies, approvals, traces, mails, operationalReport] =
        await Promise.all([
          api<ServiceStatus>("/health"),
          api<CodexHealth>("/api/codex/health").catch(
            (error: Error): CodexHealth =>
              ({
                enabled: null,
                ready: false,
                state: "unavailable",
                detail: error.message,
              }) as unknown as CodexHealth,
          ),
          api(`/api/schedule?on=${today}`),
          api(`/api/jobs/browse?first_seen_on=${today}&limit=8&sort=newest`),
          api("/api/companies"),
          api("/api/approvals"),
          api("/api/codex/traces"),
          api("/api/recruitment-mails?limit=50").catch((error: Error) => ({
            items: [],
            unavailable: true,
            freshness: { status: "failed", error_type: error.message || "mail_list_unavailable" },
          })),
          api<OperationalReport>(`/api/reports/operational?on=${today}`).catch(
            (): OperationalReport => ({ counts: {}, repair_candidates: [] }),
          ),
        ]);

      void codexHealth;
      void schedule;
      void approvals;
      void traces;
      void mails;

      set({ health, operationalReport, bootstrapping: false });

      // 第二波：各视图自己的完整加载（上游这里也是两轮 Promise.all）。
      await Promise.all([
        useAssistantStore.getState().loadWorkspace(),
        useJobsStore.getState().load({ refreshFeatured: true }),
        useJobsStore.getState().loadCompanyRankingOnly(),
        useApplicationsStore.getState().load(),
        useScheduleStore.getState().loadFull(),
        useAutomationsStore.getState().load(),
        useMailsStore.getState().load(),
        useCompaniesStore.getState().load(),
        useApprovalsStore.getState().load(),
        useTasksStore.getState().loadTraces(),
      ]);

      const jobPage = jobs as { total?: number; items?: unknown[] };
      const newJobsTotal = jobPage.total ?? 0;
      // 上游 loadCore 用同一个 /api/jobs/browse 响应同时喂指标卡和「今日新增」列表
      // （renderJobs(jobs.items) + setText("metric-new-jobs", jobs.total)）。
      // 拆成两次请求会让两者在跨零点或翻页后不一致，所以这里直接复用这份 payload。
      useJobsStore.setState({
        todayNewJobs: visibleJobs(jobPage.items as never[]),
        todayNewTotal: newJobsTotal,
      });
      const companiesList = (companies ?? []) as Array<{ integration_status: string }>;
      const approvalList = useApprovalsStore.getState().items;
      const pendingApprovals = approvalList.filter((item) => item.status === "pending").length;
      const scheduleCount = useScheduleStore.getState().todayPending.length;
      const anomalies =
        (operationalReport?.counts?.crawler_issues ??
          companiesList.filter((item) => item.integration_status !== "connected").length) || 0;

      setNavCounts({ todayJobs: newJobsTotal });
      set({
        todayLabel: today,
        lastSyncLabel: `读取于 ${new Date().toLocaleTimeString()}`,
        dashboardSummary: `服务 ${health.status} · ${health.mode} · 运营报告已读取`,
        metrics: {
          newJobs: newJobsTotal,
          newJobsDetail: "已确认 2027 校招",
          schedule: scheduleCount,
          scheduleDetail: scheduleCount ? "有安排" : "暂无安排",
          approvals: pendingApprovals,
          approvalsDetail: "等待人工确认",
          anomalies,
          anomaliesDetail: "运营报告异常",
        },
        status: "ready",
        statusText: "已连接",
      });
    } catch (error) {
      const message = (error as Error).message;
      set({ status: "error", statusText: "读取失败", bootstrapping: false, bootstrapError: message });
      showToast(message, "error");
    }
  },

  /**
   * 上游 refreshAssistantBusinessData：回合结束后只刷业务数据，
   * 明确保留会话、筛选、分页与导航不被重置。
   */
  refreshBusinessData: async () => {
    await Promise.allSettled([
      useApplicationsStore.getState().load(),
      useScheduleStore.getState().loadFull(),
      useAutomationsStore.getState().load(),
      useMailsStore.getState().load({ showLoading: false }),
      useJobsStore.getState().load({ refreshFeatured: true }),
      useApprovalsStore.getState().load(),
      useJobsStore.getState().loadTodayNewJobs(),
    ]);
    set({ lastSyncLabel: `读取于 ${new Date().toLocaleTimeString()}` });
  },

  refreshAll: async () => {
    await get().boot();
  },
}));
