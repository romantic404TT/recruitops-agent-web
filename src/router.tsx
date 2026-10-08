import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { lazy } from "react";
import { RouteFallback } from "@/components/layout/RouteFallback";

/**
 * 12 个视图全部改成真实路由（上游是 data-view 按钮 + hidden 属性，URL 不变）。
 * 页面用 React.lazy 分包：简历配置与助理这类重页面不拖累首屏。
 */
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const JobsPage = lazy(() => import("@/pages/JobsPage"));
const CompaniesPage = lazy(() => import("@/pages/CompaniesPage"));
const AssistantPage = lazy(() => import("@/pages/AssistantPage"));
const ApplicationsPage = lazy(() => import("@/pages/ApplicationsPage"));
const SchedulePage = lazy(() => import("@/pages/SchedulePage"));
const AutomationsPage = lazy(() => import("@/pages/AutomationsPage"));
const ConfigurationPage = lazy(() => import("@/pages/ConfigurationPage"));
const MailPage = lazy(() => import("@/pages/MailPage"));
const ApprovalsPage = lazy(() => import("@/pages/ApprovalsPage"));
const TasksPage = lazy(() => import("@/pages/TasksPage"));
const IntegrationsPage = lazy(() => import("@/pages/IntegrationsPage"));

const JobDetailDialog = lazy(() => import("@/dialogs/JobDetailDialog"));
const MailDetailDialog = lazy(() => import("@/dialogs/MailDetailDialog"));
const AutomationDetailDialog = lazy(() => import("@/dialogs/AutomationDetailDialog"));
const ScheduleEditorDialog = lazy(() => import("@/dialogs/ScheduleEditorDialog"));
const ApplicationCreateDialog = lazy(() => import("@/dialogs/ApplicationCreateDialog"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/jobs" replace /> },
      { path: "dashboard", element: <RouteFallback><DashboardPage /></RouteFallback> },
      {
        path: "jobs",
        element: <RouteFallback><JobsPage /></RouteFallback>,
        children: [
          { path: ":jobId", element: <RouteFallback><JobDetailDialog /></RouteFallback> },
        ],
      },
      { path: "companies", element: <RouteFallback><CompaniesPage /></RouteFallback> },
      { path: "assistant", element: <RouteFallback><AssistantPage /></RouteFallback> },
      {
        path: "applications",
        element: <RouteFallback><ApplicationsPage /></RouteFallback>,
        children: [{ path: "new", element: <RouteFallback><ApplicationCreateDialog /></RouteFallback> }],
      },
      {
        path: "schedule",
        element: <RouteFallback><SchedulePage /></RouteFallback>,
        children: [
          { path: "new", element: <RouteFallback><ScheduleEditorDialog /></RouteFallback> },
          { path: "edit/:eventId", element: <RouteFallback><ScheduleEditorDialog /></RouteFallback> },
        ],
      },
      {
        path: "automations",
        element: <RouteFallback><AutomationsPage /></RouteFallback>,
        children: [
          { path: ":automationId", element: <RouteFallback><AutomationDetailDialog /></RouteFallback> },
        ],
      },
      { path: "configuration", element: <RouteFallback><ConfigurationPage /></RouteFallback> },
      {
        path: "mail",
        element: <RouteFallback><MailPage /></RouteFallback>,
        children: [{ path: ":mailId", element: <RouteFallback><MailDetailDialog /></RouteFallback> }],
      },
      { path: "approvals", element: <RouteFallback><ApprovalsPage /></RouteFallback> },
      { path: "tasks", element: <RouteFallback><TasksPage /></RouteFallback> },
      { path: "integrations", element: <RouteFallback><IntegrationsPage /></RouteFallback> },
      { path: "*", element: <Navigate to="/jobs" replace /> },
    ],
  },
]);
