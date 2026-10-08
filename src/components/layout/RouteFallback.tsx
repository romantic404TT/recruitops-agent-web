import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/States";

/** 路由分包加载中的占位；上游所有列表初始态都是三行骨架。 */
export function RouteFallback({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingRows rows={3} />}>{children}</Suspense>;
}
