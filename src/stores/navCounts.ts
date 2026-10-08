import { create } from "zustand";

/**
 * 侧边栏计数。上游是直接 `setText("nav-job-count", …)` 打 DOM，
 * 复刻版集中成一个 store：各数据 store 在 load 完成后写入自己的那格。
 *
 * 约定：`null` 表示「尚未加载」，渲染成上游的占位符 `—`；
 * `0` 是真实计数，必须显示成 0（任务计数初始就是 0，上游 index.html:75 写死）。
 */
export type NavCountKey =
  | "jobs"
  | "todayJobs"
  | "applications"
  | "schedule"
  | "automations"
  | "mails"
  | "approvals"
  | "tasks";

export interface NavCounts {
  jobs: number | null;
  todayJobs: number | null;
  applications: number | null;
  schedule: number | null;
  automations: number | null;
  mails: number | null;
  approvals: number | null;
  tasks: number | null;
  set: (patch: Partial<Record<NavCountKey, number | null>>) => void;
}

export const useNavCounts = create<NavCounts>((set) => ({
  jobs: null,
  todayJobs: null,
  applications: null,
  schedule: null,
  automations: null,
  mails: null,
  approvals: null,
  tasks: 0,
  set: (patch) => set(patch),
}));

export const setNavCounts = (patch: Partial<Record<NavCountKey, number | null>>) =>
  useNavCounts.getState().set(patch);
