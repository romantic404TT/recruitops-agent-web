import { create } from "zustand";
import { api, authHeaders } from "@/lib/http";
import { setNavCounts } from "./navCounts";
import { showToast } from "./toast";
import type {
  Automation,
  AutomationEngine,
  AutomationListResponse,
} from "@/types/automation";

interface AutomationsState {
  items: Automation[];
  total: number;
  engine: AutomationEngine | null;
  loading: boolean;
  error: string;
  detailId: string | null;
  load: () => Promise<boolean>;
  disable: (scheduleId: string, label?: string) => Promise<void>;
}

export const useAutomationsStore = create<AutomationsState>((set, get) => ({
  items: [],
  total: 0,
  engine: null,
  loading: false,
  error: "",
  detailId: null,

  load: async () => {
    set({ loading: true, error: "" });
    try {
      const payload = await api<AutomationListResponse>("/api/automations");
      const items = Array.isArray(payload.items) ? payload.items : [];
      set({
        items,
        total: payload.total ?? items.length,
        engine: payload.engine ?? null,
        loading: false,
      });
      // 上游 nav 计数用的是「启用中」的条数，不是 total（app.js:2207）。
      setNavCounts({ automations: items.filter((item) => item.active).length });
      return true;
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
      showToast(`定时任务加载失败：${(error as Error).message}`, "error");
      return false;
    }
  },

  disable: async (scheduleId, label) => {
    const automation = get().items.find((item) => item.id === scheduleId);
    if (!automation) return;
    if (!window.confirm(`确定停用“${label ?? automation.task_label ?? "这个定时任务"}”吗？`)) return;
    try {
      await api(`/api/automations/${encodeURIComponent(scheduleId)}/disable`, {
        method: "POST",
        headers: authHeaders("停用定时任务"),
      });
      await get().load();
      showToast("定时任务已停用", "success");
    } catch (error) {
      showToast(`停用失败：${(error as Error).message}`, "error");
    }
  },
}));
