import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ToastViewport } from "@/components/ui/Toast";
import { OnboardingNotice } from "@/components/layout/OnboardingNotice";
import { useSystemStore } from "@/stores/system";
import { VIEW_TITLES } from "@/lib/labels";

/**
 * 上游 .app-shell：侧栏 + 主区（topbar + content-wrap）。
 * 与原版的关键差异：视图切换由路由驱动，所以刷新/前进后退/直链都能停在正确页面。
 */
export function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const boot = useSystemStore((state) => state.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const activeView = useMemo(() => {
    const segment = location.pathname.split("/").filter(Boolean)[0] ?? "jobs";
    return segment;
  }, [location.pathname]);

  return (
    <>
      <div className="app-shell">
        <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
        <main className="main-area">
          <Topbar
            view={activeView}
            onToggleMobile={() => setMobileOpen((value) => !value)}
            mobileOpen={mobileOpen}
          />
          <div className="content-wrap">
            <OnboardingNotice />
            <Outlet />
          </div>
        </main>
      </div>
      <ToastViewport />
    </>
  );
}

/** 供各页面复用的当前视图标题（topbar 也用同一份表）。 */
export const viewTitle = (view: string) => VIEW_TITLES[view] ?? VIEW_TITLES.jobs;
