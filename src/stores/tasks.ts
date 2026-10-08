import { create } from "zustand";
import { api } from "@/lib/http";
import { setNavCounts } from "./navCounts";
import { showToast } from "./toast";
import type { CodexTrace } from "@/types/codex";

/**
 * 运行记录视图的两块数据：
 * - traces：服务端 `/api/codex/traces`，只读最近 40 条（app.js:2714）
 * - 任务历史：assistant store 里的本地 tasks，这里只放选中项与渲染窗口
 */
interface TasksState {
  traces: CodexTrace[];
  tracesLoading: boolean;
  tracesError: string;
  selectedTaskId: string | null;
  loadTraces: () => Promise<void>;
  selectTask: (id: string | null) => void;
}

export const TRACE_RENDER_LIMIT = 40;

export const useTasksStore = create<TasksState>((set) => ({
  traces: [],
  tracesLoading: false,
  tracesError: "",
  selectedTaskId: null,

  loadTraces: async () => {
    set({ tracesLoading: true, tracesError: "" });
    try {
      const traces = await api<CodexTrace[]>("/api/codex/traces");
      set({ traces: Array.isArray(traces) ? traces : [], tracesLoading: false });
    } catch (error) {
      set({ tracesLoading: false, tracesError: (error as Error).message });
      showToast(`轨迹刷新失败：${(error as Error).message}`, "error");
    }
  },

  selectTask: (selectedTaskId) => set({ selectedTaskId }),
}));

/** 上游 renderTraces 的取值兜底：trace 记录字段名不统一。 */
export function traceTitle(trace: CodexTrace): string {
  return `${String(trace.event_type ?? trace.kind ?? "—")} · ${String(trace.method ?? trace.name ?? "—")}`;
}

export function traceTiming(trace: CodexTrace): string {
  const outcome = trace.success === false ? "停止" : "成功";
  return `${outcome} · ${String(trace.latency_ms ?? trace.elapsed_ms ?? 0)} ms`;
}

export function traceDetail(trace: CodexTrace): string {
  const reason = trace.error_code
    ? `停止原因：${trace.error_code}`
    : String(trace.phase ?? (trace.metadata?.read_only ? "只读工具" : "服务端记录"));
  return `${String(trace.thread_id ?? "未关联线程")} · ${reason}`;
}

/** 轨迹计数写回导航栏（上游没有 nav-trace，这里保留 store 一致性入口）。 */
export function syncTraceNav(count: number) {
  setNavCounts({ tasks: count });
}
