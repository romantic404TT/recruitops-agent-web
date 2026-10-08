import { create } from "zustand";
import { api, authHeaders } from "@/lib/http";
import { mailFreshnessError } from "@/lib/mail";
import { setNavCounts } from "./navCounts";
import { showToast } from "./toast";
import type {
  MailDetailResponse,
  MailFreshness,
  MailListResponse,
  MailReviewResponse,
  MailSyncCounts,
  RecruitmentMail,
} from "@/types/mail";

export type MailSyncPhase = "idle" | "syncing" | "success" | "error";

interface MailsState {
  items: RecruitmentMail[];
  total: number;
  unavailable: boolean;
  freshness: MailFreshness;
  sync: { status: MailSyncPhase; fetched: number; inserted: number; reused: number; error: string };
  loading: boolean;
  detail: MailDetailResponse | null;
  detailId: string | null;
  review: MailReviewResponse | null;
  reviewFor: string;

  load: (options?: { showLoading?: boolean }) => Promise<MailListResponse>;
  syncNow: () => Promise<void>;
  openDetail: (recordId: string) => Promise<void>;
  closeDetail: () => void;
  requestReview: (recordId: string) => Promise<void>;
}

const EMPTY_COUNTS = { fetched: 0, inserted: 0, reused: 0 };

function normalizeMailStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function mailSyncCounts(sync: MailSyncCounts | undefined): Required<MailSyncCounts> {
  const value = (key: keyof MailSyncCounts) => {
    const count = Number(sync?.[key]);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  };
  return { fetched: value("fetched"), inserted: value("inserted"), reused: value("reused") };
}

/** 上游 mailFreshnessFrom：freshness 可能在顶层也可能挂在 data 下（app.js:2415）。 */
function mailFreshnessFrom(payload: MailListResponse | null | undefined): MailFreshness {
  return payload?.freshness ?? payload?.data?.freshness ?? {};
}

export const useMailsStore = create<MailsState>((set, get) => ({
  items: [],
  total: 0,
  unavailable: false,
  freshness: { status: "unknown", synced_at: null, error_type: null },
  sync: { status: "idle", ...EMPTY_COUNTS, error: "" },
  loading: false,
  detail: null,
  detailId: null,
  review: null,
  reviewFor: "",

  load: async ({ showLoading = true } = {}) => {
    if (showLoading) set({ loading: true });
    try {
      const response = await api<MailListResponse>("/api/recruitment-mails?limit=50");
      const items = response.items ?? [];
      set({
        items,
        total: response.total ?? items.length,
        unavailable: Boolean(response.unavailable),
        freshness: mailFreshnessFrom(response),
        loading: false,
      });
      setNavCounts({ mails: items.length });
      return response;
    } catch (error) {
      // 上游降级：保留已有缓存、把 freshness 标成 failed，而不是清空列表。
      const cachedItems = get().items.slice();
      const apiError = error as Error & { name?: string };
      const errorType =
        apiError.name && apiError.name !== "Error" ? apiError.name : apiError.message;
      const freshness: MailFreshness = {
        status: "failed",
        error_type: errorType || "mail_list_unavailable",
      };
      set({
        items: cachedItems,
        total: cachedItems.length,
        unavailable: false,
        freshness,
        loading: false,
      });
      return { items: cachedItems, total: cachedItems.length, freshness };
    }
  },

  syncNow: async () => {
    if (get().sync.status === "syncing") return;
    set({ sync: { status: "syncing", ...EMPTY_COUNTS, error: "" } });
    try {
      const result = await api<MailSyncResponseLike>(
        "/api/recruitment-mails/sync?limit=100",
        { method: "POST" },
      );
      const sync = result?.sync ?? result?.data?.sync ?? {};
      const counts = mailSyncCounts(sync);
      const status = normalizeMailStatus(result?.status ?? result?.data?.status);
      if (!["synced", "success", "succeeded"].includes(status)) {
        const failure =
          mailFreshnessError(result) ?? String(result?.reason ?? "邮箱同步未完成");
        set({ sync: { status: "error", ...counts, error: failure } });
        showToast(failure, "error");
        await get().load({ showLoading: false });
        return;
      }
      set({ sync: { status: "success", ...counts, error: "" } });
      showToast("招聘邮件同步完成", "success");
      await get().load({ showLoading: false });
    } catch (error) {
      const message = (error as Error).message;
      set({ sync: { status: "error", ...EMPTY_COUNTS, error: message } });
      showToast(`邮箱同步失败：${message}`, "error");
    }
  },

  openDetail: async (recordId) => {
    set({ detail: null, detailId: recordId });
    try {
      set({ detail: await api<MailDetailResponse>(`/api/recruitment-mails/${encodeURIComponent(recordId)}`) });
    } catch (error) {
      const summary = get().items.find((mail) => mail.id === recordId);
      if (summary) {
        set({ detail: { message: summary } });
        showToast("邮件详情暂不可用，当前显示列表摘要", "info");
      } else {
        showToast(`邮件详情加载失败：${(error as Error).message}`, "error");
        set({ detailId: null });
      }
    }
  },

  closeDetail: () => set({ detail: null, detailId: null }),

  requestReview: async (recordId) => {
    set({ review: null, reviewFor: recordId });
    try {
      const payload = await api<MailReviewResponse>(
        `/api/recruitment-mails/${encodeURIComponent(recordId)}/review`,
        {
          method: "POST",
          headers: authHeaders("生成邮件关联预览", { "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        },
      );
      set({ review: payload });
    } catch (error) {
      showToast(`关联预览生成失败：${(error as Error).message}`, "error");
    }
  },
}));

type MailSyncResponseLike = {
  status?: string;
  sync?: MailSyncCounts;
  reason?: string;
  error?: string;
  error_type?: string;
  data?: { status?: string; sync?: MailSyncCounts };
};
