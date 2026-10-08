import { create } from "zustand";
import { api, authHeaders } from "@/lib/http";
import type {
  CompanySourceEntryPatch,
  CompanySourceJobPage,
  CompanySourceListResponse,
  CompanySourceRecord,
  CompanySourceRetryResponse,
  CompanySourceStatus,
} from "@/types/companySource";
import { showToast } from "./toast";

export interface CompanySourceQuery {
  page: number;
  page_size: number;
  q: string;
  status: CompanySourceStatus | "";
}

/** 上游 company-sources.js:133 —— 只带非空参数。 */
export function companySourceQueryUrl(query: CompanySourceQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  params.set("q", query.q ?? "");
  if (query.status) params.set("status", query.status);
  return `/api/company-sources?${params.toString()}`;
}

interface CompanySourcesState {
  items: CompanySourceRecord[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  statusFilter: CompanySourceStatus | "";
  loading: boolean;
  error: string;
  detail: CompanySourceRecord | null;
  detailJobs: CompanySourceJobPage | null;
  requestId: number;

  setSearch: (value: string) => void;
  setStatusFilter: (value: CompanySourceStatus | "") => void;
  setPage: (value: number) => void;
  load: () => Promise<void>;
  loadDetailJobs: (recordId: string) => Promise<void>;
  openDetail: (recordId: string) => Promise<void>;
  closeDetail: () => void;
  saveEntryUrl: (
    recordId: string,
    body: CompanySourceEntryPatch,
  ) => Promise<void>;
  retry: (recordId: string) => Promise<void>;
}

export const useCompanySourcesStore = create<CompanySourcesState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 30,
  search: "",
  statusFilter: "",
  loading: false,
  error: "",
  detail: null,
  detailJobs: null,
  requestId: 0,

  setSearch: (search) => set({ search, page: 1 }),
  setStatusFilter: (statusFilter) => set({ statusFilter, page: 1 }),
  setPage: (page) => set({ page }),

  load: async () => {
    const requestId = get().requestId + 1;
    set({ requestId, loading: true, error: "" });
    try {
      const payload = await api<CompanySourceListResponse>(
        companySourceQueryUrl({
          page: get().page,
          page_size: get().pageSize,
          q: get().search,
          status: get().statusFilter,
        }),
      );
      if (get().requestId !== requestId) return;
      set({
        items: payload.items ?? [],
        total: payload.total ?? 0,
        page: payload.page ?? get().page,
        pageSize: payload.page_size ?? get().pageSize,
        loading: false,
      });
    } catch (error) {
      if (get().requestId !== requestId) return;
      set({ loading: false, error: (error as Error).message });
    }
  },

  loadDetailJobs: async (recordId) => {
    try {
      const page = await api<CompanySourceJobPage>(
        `/api/company-sources/${encodeURIComponent(recordId)}/jobs?page=1&page_size=30`,
      );
      set({ detailJobs: page });
    } catch {
      set({ detailJobs: null });
    }
  },

  openDetail: async (recordId) => {
    set({ detail: null, detailJobs: null });
    try {
      const detail = await api<CompanySourceRecord>(
        `/api/company-sources/${encodeURIComponent(recordId)}`,
      );
      set({ detail });
      await get().loadDetailJobs(recordId);
    } catch (error) {
      showToast(`来源详情加载失败：${(error as Error).message}`, "error");
    }
  },

  closeDetail: () => set({ detail: null, detailJobs: null }),

  /** 改入口地址要回传读取时的 updated_at，冲突由上游返回 409。 */
  saveEntryUrl: async (recordId, body) => {
    try {
      await api(`/api/company-sources/${encodeURIComponent(recordId)}/entry`, {
        method: "PATCH",
        headers: authHeaders("更新入口地址", { "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      showToast("入口地址已更新", "success");
      await get().load();
      if (get().detail?.id === recordId) await get().openDetail(recordId);
    } catch (error) {
      showToast(`更新失败：${(error as Error).message}`, "error");
    }
  },

  retry: async (recordId) => {
    try {
      const result = await api<CompanySourceRetryResponse>(
        `/api/company-sources/${encodeURIComponent(recordId)}/retry`,
        { method: "POST", headers: authHeaders("重试抓取") },
      );
      showToast(`已启动重新抓取（${result.status}）`, "success");
      await get().load();
    } catch (error) {
      showToast(`重试失败：${(error as Error).message}`, "error");
    }
  },
}));
