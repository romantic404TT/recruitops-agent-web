import { create } from "zustand";
import { api, authHeaders } from "@/lib/http";
import { safeJson } from "@/lib/format";
import { setNavCounts } from "./navCounts";
import { showToast } from "./toast";
import type {
  ApprovalEnvelope,
  ApprovalPreview,
  FlatApproval,
} from "@/types/domain";
import { useApplicationsStore } from "./applications";
import { useScheduleStore } from "./schedule";
import { useJobsStore } from "./jobs";

/**
 * 上游 normalizeApprovals（app.js:473）：
 * `{token, preview}` 摊平成 `{...token, preview}`，已是扁平形态的原样保留。
 */
export function normalizeApprovals(
  items: Array<ApprovalEnvelope | FlatApproval> | null | undefined,
): FlatApproval[] {
  return (items ?? []).map((item) =>
    (item as ApprovalEnvelope)?.token
      ? { ...(item as ApprovalEnvelope).token, preview: (item as ApprovalEnvelope).preview ?? null }
      : (item as FlatApproval),
  );
}

interface ApprovalsState {
  items: FlatApproval[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  decide: (tokenId: string, decision: "approve" | "reject") => Promise<void>;
  execute: (tokenId: string) => Promise<void>;
  register: (preview: ApprovalPreview) => Promise<void>;
  copyToken: (tokenId: string) => Promise<void>;
}

const jsonHeaders = (reason: string) =>
  authHeaders(reason, { "Content-Type": "application/json" });

function countPending(items: FlatApproval[]) {
  setNavCounts({ approvals: items.filter((item) => item.status === "pending").length });
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  items: [],
  loading: false,
  error: "",

  load: async () => {
    set({ loading: true, error: "" });
    try {
      const items = normalizeApprovals(await api<ApprovalEnvelope[]>("/api/approvals"));
      set({ items, loading: false });
      countPending(items);
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
    }
  },

  decide: async (tokenId, decision) => {
    try {
      await api(`/api/approvals/${encodeURIComponent(tokenId)}/${decision}`, {
        method: "POST",
        headers: authHeaders("确认审批决定"),
      });
      showToast("审批状态已更新", "success");
      await get().load();
    } catch (error) {
      showToast((error as Error).message, "error");
    }
  },

  /**
   * 执行入口刻意保留上游的 window.prompt 交互：操作人名称必须由人给出，
   * 上游把它当作审计记录的必填主体，不做默认值。
   */
  execute: async (tokenId) => {
    const operator = window.prompt("请输入本次操作人名称");
    if (!operator?.trim()) return;
    try {
      await api(`/api/approvals/${encodeURIComponent(tokenId)}/execute`, {
        method: "POST",
        headers: jsonHeaders("执行已批准操作"),
        body: JSON.stringify({ operator: operator.trim() }),
      });
      showToast("已执行获批操作，并生成审计记录", "success");
      await get().load();
      await Promise.all([
        useApplicationsStore.getState().load(),
        useScheduleStore.getState().loadFull(),
        useJobsStore.getState().load(),
      ]);
    } catch (error) {
      showToast((error as Error).message, "error");
    }
  },

  register: async (preview) => {
    try {
      await api("/api/approvals", {
        method: "POST",
        headers: jsonHeaders("登记审批预览"),
        body: JSON.stringify(preview),
      });
      await get().load();
      showToast("审批已登记，等待你的批准或拒绝", "success");
    } catch (error) {
      showToast((error as Error).message, "error");
    }
  },

  copyToken: async (tokenId) => {
    if (!tokenId) {
      showToast("审批令牌不存在", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(tokenId);
      showToast("单次令牌已复制，请在目标页面完成读取", "success");
    } catch {
      // 上游的兜底：剪贴板不可用时退回弹窗让用户手动复制。
      window.prompt("请复制单次审批令牌", tokenId);
    }
  },
}));

/** 审批卡片里那段折叠 JSON 的原始格式，抽出来给 approvals / assistant 共用。 */
export function approvalPreviewJson(approval: FlatApproval): string {
  if (!approval.preview) return "";
  return safeJson({
    target_id: approval.preview.target_id,
    before: approval.preview.before,
    after: approval.preview.after,
    payload: approval.preview.payload,
  });
}

export function approvalEvidenceText(approval: FlatApproval): string {
  return `证据：${approval.preview?.evidence_summary ?? "未提供"}`;
}
