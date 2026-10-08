import { create } from "zustand";
import { api } from "@/lib/http";
import { localDate, visibleJobs } from "@/lib/format";
import { setNavCounts } from "./navCounts";
import type {
  CompanyJobSummary,
  JobBrowseFacets,
  JobBrowseItem,
  JobBrowsePage,
  JobBrowseStats,
  JobDetail,
} from "@/types/domain";

/** 岗位浏览模式：上游 data-job-mode = all | today。 */
export type JobBrowseMode = "all" | "today";

export interface JobFilters {
  query: string;
  company: string;
  category: string;
  platform: string;
  evaluation: string;
  score_band: string;
  sort: "score" | "newest" | "company";
}

export const EMPTY_FILTERS: JobFilters = {
  query: "",
  company: "",
  category: "",
  platform: "",
  evaluation: "",
  score_band: "",
  sort: "score",
};

export const PAGE_SIZE = 50;

interface JobsState {
  mode: JobBrowseMode;
  page: number;
  filters: JobFilters;
  items: JobBrowseItem[];
  featured: JobBrowseItem[];
  total: number;
  allTotal: number;
  todayTotal: number;
  stats: JobBrowseStats | null;
  facets: JobBrowseFacets;
  companySummaries: CompanyJobSummary[];
  /** 今日新增（首页 job-card 列表用，走 limit=8&sort=newest）。 */
  todayNewJobs: JobBrowseItem[];
  todayNewTotal: number;
  loading: boolean;
  error: string;
  requestId: number;
  detail: JobDetail | null;
  detailLoading: boolean;
  detailError: string;

  setMode: (mode: JobBrowseMode) => void;
  setFilter: (patch: Partial<JobFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  load: (options?: { refreshFeatured?: boolean }) => Promise<boolean>;
  loadTodayNewJobs: () => Promise<void>;
  loadCompanyRankingOnly: () => Promise<void>;
  openDetail: (jobId: string) => Promise<void>;
  closeDetail: () => void;
}

/**
 * 上游 jobBrowseQuery()（app.js:1087）逐字翻译。
 * 注意 evaluation 只接受 4 个值，第 5 个选项 `excluded` 前端不发。
 */
export function jobBrowseQuery(
  mode: JobBrowseMode,
  page: number,
  filters: JobFilters,
): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    sort: filters.sort,
  });
  if (mode === "today") params.set("first_seen_on", localDate());
  const fields: Array<[string, string]> = [
    ["query", filters.query.trim()],
    ["company", filters.company],
    ["category", filters.category],
    ["platform", filters.platform],
    ["score_band", filters.score_band],
  ];
  fields.forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (["scored", "unscored", "pending", "jd_incomplete"].includes(filters.evaluation)) {
    params.set("evaluation", filters.evaluation);
  }
  return params;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  mode: "all",
  page: 1,
  filters: { ...EMPTY_FILTERS },
  items: [],
  featured: [],
  total: 0,
  allTotal: 0,
  todayTotal: 0,
  stats: null,
  facets: { companies: [], categories: {}, platforms: [] },
  companySummaries: [],
  todayNewJobs: [],
  todayNewTotal: 0,
  loading: false,
  error: "",
  requestId: 0,
  detail: null,
  detailLoading: false,
  detailError: "",

  setMode: (mode) => set({ mode, page: 1 }),
  setFilter: (patch) => set((state) => ({ filters: { ...state.filters, ...patch }, page: 1 })),
  resetFilters: () => set({ filters: { ...EMPTY_FILTERS }, page: 1 }),
  setPage: (page) => set({ page: Math.max(1, page) }),

  load: async ({ refreshFeatured = false } = {}) => {
    const requestId = get().requestId + 1;
    set({ requestId, loading: true, error: "" });
    try {
      const { mode, page, filters } = get();
      const payload = await api<JobBrowsePage>(
        `/api/jobs/browse?${jobBrowseQuery(mode, page, filters).toString()}`,
      );
      // 上游用 requestId 比对丢弃过期响应（app.js:1264），这里保持同样的竞态防护。
      if (get().requestId !== requestId) return false;

      const stats = payload.stats;
      const patch: Partial<JobsState> = {
        items: visibleJobs(payload.items),
        total: payload.total || 0,
        stats,
        loading: false,
      };
      if (mode === "today") {
        patch.todayTotal = stats?.jobs ?? 0;
      } else {
        patch.allTotal = stats?.jobs ?? 0;
        if (payload.facets) {
          patch.facets = payload.facets;
          patch.companySummaries = payload.facets.companies ?? [];
        }
      }
      if (refreshFeatured || !get().featured.length) {
        patch.featured = visibleJobs(payload.featured || []);
      }
      set(patch);
      setNavCounts(
        mode === "today"
          ? { todayJobs: patch.todayTotal ?? 0 }
          : { jobs: patch.allTotal ?? 0 },
      );
      return true;
    } catch (error) {
      if (get().requestId !== requestId) return false;
      set({ loading: false, error: (error as Error).message });
      return false;
    }
  },

  loadTodayNewJobs: async () => {
    try {
      const payload = await api<JobBrowsePage>(
        `/api/jobs/browse?first_seen_on=${localDate()}&limit=8&sort=newest`,
      );
      set({
        todayNewJobs: visibleJobs(payload.items || []),
        todayNewTotal: payload.total || 0,
      });
    } catch {
      // 上游这里没有 catch：整个 loadCore 会失败。复刻版把首页降级成局部失败。
      set({ todayNewJobs: [], todayNewTotal: 0 });
    }
  },

  /** 公司排行只要 facets：上游用 limit=1 省流量（app.js:1072）。 */
  loadCompanyRankingOnly: async () => {
    try {
      const payload = await api<JobBrowsePage>(
        "/api/jobs/browse?limit=1&offset=0&sort=score",
      );
      set({
        facets: payload.facets ?? { companies: [], categories: {}, platforms: [] },
        companySummaries: payload.facets?.companies ?? [],
      });
    } catch {
      set({ companySummaries: [] });
    }
  },

  openDetail: async (jobId) => {
    set({ detail: null, detailLoading: true, detailError: "" });
    try {
      set({ detail: await api<JobDetail>(`/api/jobs/${encodeURIComponent(jobId)}`), detailLoading: false });
    } catch (error) {
      set({ detailLoading: false, detailError: (error as Error).message });
    }
  },

  closeDetail: () => set({ detail: null, detailError: "", detailLoading: false }),
}));

/** findBrowseJob（app.js:1284）：详情弹层要从已加载的列表里补公司名和投递阶段。 */
export function findBrowseJob(jobId: string | undefined): JobBrowseItem | undefined {
  const state = useJobsStore.getState();
  return [...state.items, ...state.featured].find((item) => item.id === jobId);
}
