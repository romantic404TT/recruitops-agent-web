import { create } from "zustand";

export type ToastKind = "info" | "success" | "error" | "warn";

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

/** 上游 showToast 的行为：插入 .toast--{kind}，4200ms 后自动移除（app.js:481）。 */
export const TOAST_DURATION_MS = 4200;

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, kind = "info") => {
    const id = nextId++;
    set((state) => ({ items: [...state.items, { id, message, kind }] }));
    window.setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    }, TOAST_DURATION_MS);
  },
  dismiss: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}));

/** 便于在非 React 模块（如 http 层）里复用同一个 toast。 */
export const showToast = (message: string, kind: ToastKind = "info") =>
  useToastStore.getState().push(message, kind);
