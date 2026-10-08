import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SectionHeading, MetricItem, WorkspaceSection, MutedLabel } from "@/components/ui/Section";
import { EmptyState, LoadingRows } from "@/components/ui/States";
import { UiIcon } from "@/components/ui/UiIcon";
import { TodoCard, type DashboardTodo } from "@/components/dashboard/TodoCard";
import { safeScheduleHref, text } from "@/lib/format";
import { useSystemStore } from "@/stores/system";
import { useJobsStore } from "@/stores/jobs";
import { useScheduleStore } from "@/stores/schedule";
import { useCompaniesStore } from "@/stores/companies";
import { useApprovalsStore } from "@/stores/approvals";
import type { OperationalReport, ScheduleEvent } from "@/types/domain";

/** 上游 row()：左时间、右标题，可选外链。首页多个列表共用。 */
function DataRow({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <div className="data-row">
      <span className="row-time">{label}</span>
      {href ? (
        <a className="row-title" href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span className="row-title">{value}</span>
      )}
    </div>
  );
}

function scheduleRow(event: ScheduleEvent) {
  const location = text(event.location_or_link, "").trim();
  const href = safeScheduleHref(location);
  const title = `${text(event.event_type)} · ${text(event.company_name)} · ${text(event.job_title)}`;
  return {
    label: event.event_time ? event.event_time.slice(0, 5) : "时间待定",
    value: location && !href ? `${title} · ${location}` : title,
    href,
  };
}

/** 今日工作台（上游 #dashboard-view，index.html:120-244）。 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const metrics = useSystemStore((state) => state.metrics);
  const lastSyncLabel = useSystemStore((state) => state.lastSyncLabel);
  const summary = useSystemStore((state) => state.dashboardSummary);
  const report = useSystemStore((state) => state.operationalReport);
  const loading = useSystemStore((state) => state.bootstrapping);
  const todayJobs = useJobsStore((state) => state.todayNewJobs);
  const schedules = useScheduleStore((state) => state.todayPending);
  const allSchedules = useScheduleStore((state) => state.all);
  const companies = useCompaniesStore((state) => state.companies);
  const approvals = useApprovalsStore((state) => state.items);

  const pendingApprovals = approvals.filter((item) => item.status === "pending");
  const unconnected = companies.filter((item) => item.integration_status !== "connected");
  const repairCandidates: NonNullable<OperationalReport["repair_candidates"]> = report?.repair_candidates ?? [];

  // 待办四条的判定条件与上游 renderDashboardTodos 完全一致。
  const todos: DashboardTodo[] = [
    schedules.length
      ? { kind: "pending", kindLabel: "日程", status: `${schedules.length} 项待看`, title: "核对今天的笔试、面试和截止事项", detail: "按时间查看下一项安排。", actionLabel: "查看日程", view: "schedule" }
      : { kind: "success", kindLabel: "日程", status: "暂无", title: "今天没有已记录日程", detail: "可以继续查询岗位或投递状态。", actionLabel: "询问助理", taskType: "today_schedule" },
    todayJobs.length
      ? { kind: "pending", kindLabel: "岗位", status: `${todayJobs.length} 个新增`, title: "筛选今天新增的确认岗位", detail: "仅纳入 2027 校招且届别已确认的岗位。", actionLabel: "交给助理筛选", taskType: "today_new_jobs" }
      : { kind: "success", kindLabel: "岗位", status: "暂无", title: "等待新的确认岗位", detail: "仅纳入 2027 校招且届别已确认的岗位。", actionLabel: "交给助理筛选", taskType: "today_new_jobs" },
    pendingApprovals.length
      ? { kind: "pending", kindLabel: "审批", status: `${pendingApprovals.length} 项待确认`, title: "核对需要人工确认的操作预览", detail: "所有写入都必须经过明确的人工确认。", actionLabel: "打开审批中心", view: "approvals" }
      : { kind: "success", kindLabel: "审批", status: "已清空", title: "暂无待审批操作", detail: "所有写入都必须经过明确的人工确认。", actionLabel: "查看审批中心", view: "approvals" },
    unconnected.length
      ? { kind: "warning", kindLabel: "接入", status: `${unconnected.length} 家待确认`, title: "检查未完成的公司接入", detail: "这里只读取配置，不会修改公司来源。", actionLabel: "查看接入", view: "companies" }
      : { kind: "success", kindLabel: "接入", status: "正常", title: "当前公司接入状态正常", detail: "这里只读取配置，不会修改公司来源。", actionLabel: "查看接入", view: "companies" },
  ];

  const anomalies = [
    ...unconnected.slice(0, 4).map((company) => ({ label: company.name, value: "待确认接入" })),
    ...repairCandidates.slice(0, Math.max(0, 6 - Math.min(unconnected.length, 4))).map((issue) => ({
      label: issue.company ?? issue.crawler_key ?? issue.type ?? "运行报告",
      value: issue.recommendation ?? issue.message ?? "需要人工复核",
    })),
  ];

  return (
    <section className="view-panel is-visible" data-view-panel="dashboard" aria-labelledby="dashboard-heading">
      <SectionHeading
        eyebrow="今天要处理的事情"
        titleId="dashboard-heading"
        title="今日工作台"
        actions={
          <>
            <Button variant="secondary" icon="plus" onClick={() => navigate("/assistant")}>
              问求职助理
            </Button>
            <Button variant="ghost" onClick={() => navigate("/jobs")}>
              浏览全部岗位
            </Button>
          </>
        }
      />

      <div className="metric-grid" aria-label="今日摘要">
        <MetricItem bar="teal" label="今日新增" value={metrics.newJobs} detail={metrics.newJobsDetail} />
        <MetricItem bar="blue" label="日程" value={metrics.schedule} detail={metrics.scheduleDetail} />
        <MetricItem bar="amber" label="异常" value={metrics.anomalies} detail={metrics.anomaliesDetail} />
        <MetricItem bar="rose" label="待审批" value={metrics.approvals} detail={metrics.approvalsDetail} />
      </div>

      <WorkspaceSection className="todo-section" ariaLabelledby="todo-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">行动清单</p>
            <h3 id="todo-heading">今日待办</h3>
          </div>
          <MutedLabel>{`${todos.filter((todo) => todo.kind !== "success").length} 项需关注`}</MutedLabel>
        </div>
        <div className="todo-grid" data-state={loading ? "loading" : "ready"} aria-live="polite">
          {loading ? <LoadingRows rows={3} /> : todos.map((todo) => <TodoCard key={todo.kindLabel} todo={todo} />)}
        </div>
      </WorkspaceSection>

      <div className="dashboard-grid">
        <WorkspaceSection ariaLabelledby="schedule-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">接下来</p>
              <h3 id="schedule-heading">今日安排</h3>
            </div>
            <button className="text-button" type="button" onClick={() => navigate("/schedule")}>
              查看完整日程 <UiIcon name="arrow-right" />
            </button>
          </div>
          <div className="data-list" data-state={loading ? "loading" : "ready"}>
            {loading ? <LoadingRows rows={3} /> : null}
            {!loading && schedules.length === 0 ? (
              <EmptyState title="今天没有已记录安排" detail="日程会从投递记录中读取。" />
            ) : null}
            {!loading
              ? schedules.slice(0, 6).map((event) => {
                  const row = scheduleRow(event);
                  return <DataRow key={event.id} {...row} />;
                })
              : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection ariaLabelledby="new-jobs-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">岗位情报</p>
              <h3 id="new-jobs-heading">今日新增</h3>
            </div>
            <button className="text-button" type="button" onClick={() => navigate("/assistant")}>
              交给助理筛选 <UiIcon name="arrow-right" />
            </button>
          </div>
          <div className="data-list" data-state={loading ? "loading" : "ready"}>
            {loading ? <LoadingRows rows={3} /> : null}
            {!loading && todayJobs.length === 0 ? (
              <EmptyState title="今天没有新的确认岗位" detail="只显示已确认的 2027 校招岗位。" />
            ) : null}
            {!loading
              ? todayJobs.slice(0, 8).map((job) => (
                  <DataRow key={job.id} label={job.platform} value={`${job.title} · ${job.company_name}`} />
                ))
              : null}
          </div>
        </WorkspaceSection>
      </div>

      <div className="dashboard-grid dashboard-grid--lower">
        <WorkspaceSection ariaLabelledby="anomalies-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">需要留意</p>
              <h3 id="anomalies-heading">异常</h3>
            </div>
            <button className="text-button" type="button" onClick={() => navigate("/integrations")}>
              查看接入 <UiIcon name="arrow-right" />
            </button>
          </div>
          <div className="data-list" data-state={loading ? "loading" : "ready"}>
            {loading ? <LoadingRows rows={2} short /> : null}
            {!loading && anomalies.length === 0 ? (
              <EmptyState title="暂无运营异常" detail="公司接入和最近一次运行报告均正常。" />
            ) : null}
            {!loading
              ? anomalies.map((item, index) => (
                  <DataRow key={`${item.label}-${index}`} label={item.label} value={item.value} />
                ))
              : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection ariaLabelledby="pending-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">人工确认</p>
              <h3 id="pending-heading">待审批</h3>
            </div>
            <button className="text-button" type="button" onClick={() => navigate("/approvals")}>
              打开审批中心 <UiIcon name="arrow-right" />
            </button>
          </div>
          <div className="data-list" data-state={loading ? "loading" : "ready"}>
            {loading ? <LoadingRows rows={2} short /> : null}
            {!loading && pendingApprovals.length === 0 ? (
              <EmptyState title="暂无待审批操作" detail="只读任务不会自动生成写操作。" />
            ) : null}
            {!loading
              ? pendingApprovals.slice(0, 6).map((approval) => (
                  <DataRow key={approval.token_id} label={approval.operation} value={approval.task_id} />
                ))
              : null}
          </div>
        </WorkspaceSection>
      </div>

      <WorkspaceSection className="activity-strip" ariaLabelledby="activity-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">最近一次同步</p>
            <h3 id="activity-heading">运营状态</h3>
          </div>
          <MutedLabel>{lastSyncLabel}</MutedLabel>
        </div>
        <div className="status-summary">
          <span className="status-dot status-dot--ok" aria-hidden="true" />
          <span>{summary}</span>
          <span className="muted-label">{`全部日程 ${allSchedules.length} 项`}</span>
        </div>
      </WorkspaceSection>
    </section>
  );
}
