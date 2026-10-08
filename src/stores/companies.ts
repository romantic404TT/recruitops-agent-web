import { create } from "zustand";
import { api } from "@/lib/http";
import type { Company } from "@/types/domain";

/**
 * GET /api/companies —— 公司配置快照。
 * 上游一份数据同时喂给「数据接入」视图和首页待办，这里也共用一个 store。
 */
interface CompaniesState {
  companies: Company[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  connectedCount: () => number;
  unconnectedCount: () => number;
}

export const useCompaniesStore = create<CompaniesState>((set, get) => ({
  companies: [],
  loading: false,
  error: "",

  load: async () => {
    set({ loading: true, error: "" });
    try {
      set({ companies: await api<Company[]>("/api/companies"), loading: false });
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
    }
  },

  connectedCount: () =>
    get().companies.filter((item) => item.integration_status === "connected").length,
  unconnectedCount: () =>
    get().companies.filter((item) => item.integration_status !== "connected").length,
}));
