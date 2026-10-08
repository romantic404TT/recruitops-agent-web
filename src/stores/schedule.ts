import { create } from "zustand";
import { api, authHeaders } from "@/lib/http";
import {
  localDate,
  normalizeScheduleStatus,
  scheduleSortValue,
} from "@/lib/format";
import { SCHEDULE_STATUS_LABELS, LOCAL_SCHEDULE_EVENTS_URL } from "@/lib/labels";
import { setNavCounts } from "./navCounts";
import { showToast } from "./toast";
import type { ScheduleEvent } from "@/types/domain";
import type {
  ScheduleEventCreateBody,
  ScheduleEventMutationResponse,
} from "@/types/localUi";

export type ScheduleView = "todo" | "calendar";
/** `all` 是前端专有的「全部状态」选项，上游 select 里就有（index.html:361）。 */
export type ScheduleStatusFilter = "pending" | "completed" | "ignored" | "all";

interface ScheduleState {
  /** 今日待办 —— 首页「今日安排」与 metric 用。 */
  todayPending: ScheduleEvent[];
  all: ScheduleEvent[];
  view: ScheduleView;
  status: ScheduleStatusFilter;
  dateFilter: string;
  month: string;
  editing: ScheduleEvent | null;
  editorOpen: boolean;
  loading: boolean;
  error: string;
  requestId: number;

  setView: (view: ScheduleView) => void;
  setStatus: (status: ScheduleStatusFilter) => void;
  setDateFilter: (date: string) => void;
  setMonth: (month: string) => void;
  goToday: () => void;
  goAll: () => void;
  openEditor: (event?: ScheduleEvent | null) => void;
  closeEditor: () => void;
  filtered: () => ScheduleEvent[];
  loadFull: () => Promise<boolean>;
  loadOn: (date: string) => Promise<ScheduleEvent[]>;
  changeStatus: (eventId: string, status: "pending" | "completed" | "ignored") => Promise<void>;
  save: (body: ScheduleEventCreateBody, editing?: ScheduleEvent | null) => Promise<void>;
}

const jsonHeaders = (reason: string) =>
  authHeaders(reason, { "Content-Type": "application/json" });

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  todayPending: [],
  all: [],
  view: "todo",
  status: "pending",
  dateFilter: "",
  month: "",
  editing: null,
  editorOpen: false,
  loading: false,
  error: "",
  requestId: 0,

  setView: (view) => set({ view }),
  setStatus: (status) => set({ status }),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  setMonth: (month) => set({ month }),
  goToday: () => set({ dateFilter: localDate(), status: "pending" }),
  goAll: () => set({ dateFilter: "", status: "all" }),
  openEditor: (event = null) => set({ editing: event ?? null, editorOpen: true }),
  closeEditor: () => set({ editing: null, editorOpen: false }),

  /** 上游 scheduleEventsForCurrentFilter()：状态 + 精确日期，再按 date/time/id 排序。 */
  filtered: () => {
    const { all, status, dateFilter } = get();
    return all
      .filter((event) => status === "all" || normalizeScheduleStatus(event.status) === status)
      .filter((event) => !dateFilter || event.event_date === dateFilter)
      .slice()
      .sort((left, right) => scheduleSortValue(left).localeCompare(scheduleSortValue(right)));
  },

  loadFull: async () => {
    const requestId = get().requestId + 1;
    set({ requestId, loading: true, error: "" });
    try {
      const payload = await api<ScheduleEvent[]>("/api/schedule");
      if (get().requestId !== requestId) return false;
      const all = Array.isArray(payload) ? payload : [];
      const todayPending = all.filter(
        (event) =>
          event.event_date === localDate() &&
          normalizeScheduleStatus(event.status) === "pending",
      );
      set({ all, todayPending, loading: false });
      setNavCounts({ schedule: todayPending.length });
      return true;
    } catch (error) {
      if (get().requestId !== requestId) return false;
      set({ loading: false, error: (error as Error).message });
      showToast(`日程加载失败：${(error as Error).message}`, "error");
      return false;
    }
  },

  loadOn: async (date) => {
    try {
      const payload = await api<ScheduleEvent[]>(`/api/schedule?on=${date}`);
      return Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
  },

  changeStatus: async (eventId, status) => {
    const event = get().all.find((item) => item.id === eventId);
    if (!event || !SCHEDULE_STATUS_LABELS[status]) return;
    try {
      await api(`${LOCAL_SCHEDULE_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: jsonHeaders(`更新日程为${SCHEDULE_STATUS_LABELS[status]}`),
        body: JSON.stringify({ status, expected_updated_at: event.updated_at }),
      });
      await get().loadFull();
      showToast(`日程已${SCHEDULE_STATUS_LABELS[status]}`, "success");
    } catch (error) {
      showToast(`日程状态更新失败：${(error as Error).message}`, "error");
    }
  },

  /** 新增走 POST、编辑走 PATCH 并带上原状态与并发戳（app.js:2028）。 */
  save: async (body, editing = null) => {
    if (editing) {
      const payload = {
        ...body,
        status: normalizeScheduleStatus(editing.status),
        expected_updated_at: editing.updated_at,
      };
      await api<ScheduleEventMutationResponse>(
        `${LOCAL_SCHEDULE_EVENTS_URL}/${encodeURIComponent(editing.id)}`,
        { method: "PATCH", headers: jsonHeaders("编辑日程"), body: JSON.stringify(payload) },
      );
      set({ editorOpen: false, editing: null });
      await get().loadFull();
      showToast("日程已更新", "success");
      return;
    }
    await api<ScheduleEventMutationResponse>(LOCAL_SCHEDULE_EVENTS_URL, {
      method: "POST",
      headers: jsonHeaders("添加日程"),
      body: JSON.stringify(body),
    });
    set({ editorOpen: false, editing: null });
    await get().loadFull();
    showToast("日程已添加", "success");
  },
}));
