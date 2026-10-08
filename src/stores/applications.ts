import { create } from "zustand";
import { api, authHeaders } from "@/lib/http";
import { setNavCounts } from "./navCounts";
import type { Application, ApplicationPage, ApplicationStage } from "@/types/domain";
import type {
  ApplicationEditBody,
  ApplicationLinkBody,
  ApplicationRecordResponse,
  ManualApplicationResponse,
} from "@/types/localUi";
import type { ApplicationResult } from "@/types/localUi";
import { showToast } from "./toast";

interface ApplicationsState {
  items: Application[];
  total: number;
  loading: boolean;
  error: string;
  requestId: number;
  load: () => Promise<boolean>;
  updateStage: (
    id: string,
    body: { stage: ApplicationStage; result: ApplicationResult; note: string; expected_updated_at: string },
  ) => Promise<void>;
  saveRecordUrl: (id: string, body: ApplicationLinkBody) => Promise<void>;
  remove: (id: string, expectedUpdatedAt: string) => Promise<void>;
  recordFromJob: (jobId: string) => Promise<ApplicationRecordResponse>;
  createManual: (body: {
    company_name: string;
    job_title: string;
    stage: ApplicationStage;
    record_url?: string | null;
    note?: string;
  }) => Promise<ManualApplicationResponse>;
}

const jsonHeaders = () => authHeaders("编辑投递", { "Content-Type": "application/json" });

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  items: [],
  total: 0,
  loading: false,
  error: "",
  requestId: 0,

  load: async () => {
    const requestId = get().requestId + 1;
    set({ requestId, loading: true, error: "" });
    try {
      const payload = await api<ApplicationPage>("/api/applications/page?limit=200&offset=0");
      if (get().requestId !== requestId) return false;
      set({ items: payload.items ?? [], total: payload.total ?? 0, loading: false });
      setNavCounts({ applications: payload.total ?? 0 });
      return true;
    } catch (error) {
      if (get().requestId !== requestId) return false;
      set({ loading: false, error: (error as Error).message });
      return false;
    }
  },

  updateStage: async (id, body) => {
    const patch: ApplicationEditBody = body;
    await api(`/api/local-ui/applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(patch),
    });
    showToast("投递记录已更新", "success");
    await get().load();
  },

  saveRecordUrl: async (id, body) => {
    await api(`/api/local-ui/applications/${encodeURIComponent(id)}/record-url`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    });
    showToast("进度页链接已保存，投递阶段未改变", "success");
    await get().load();
  },

  remove: async (id, expected_updated_at) => {
    await api(`/api/local-ui/applications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: jsonHeaders(),
      body: JSON.stringify({ expected_updated_at }),
    });
    showToast("投递记录已删除", "success");
  },

  recordFromJob: async (jobId) => {
    const result = await api<ApplicationRecordResponse>("/api/local-ui/applications", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ job_id: jobId }),
    });
    showToast(result.created ? "已记录投递" : "已有投递记录，保留原阶段", "success");
    return result;
  },

  createManual: async (body) => {
    const result = await api<ManualApplicationResponse>("/api/local-ui/applications/manual", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...body, record_url: body.record_url || null }),
    });
    showToast(
      result.created ? "投递已添加" : "已有相同公司和岗位的投递，保留原记录",
      "success",
    );
    await get().load();
    return result;
  },
}));
