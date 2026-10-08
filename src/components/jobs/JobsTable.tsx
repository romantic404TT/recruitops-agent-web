import { useNavigate } from "react-router-dom";
import { Button, IconButton } from "@/components/ui/Button";
import { ScoreBadge, TableEmptyRow, TableLoadingRow } from "@/components/ui/States";
import { Pager } from "@/components/ui/Pager";
import { applicationStageLabel, text } from "@/lib/format";
import { PAGE_SIZE, useJobsStore } from "@/stores/jobs";
import { useApplicationsStore } from "@/stores/applications";
import { useAssistantStore } from "@/stores/assistant";
import { showToast } from "@/stores/toast";
import { DEFAULT_QUESTIONS } from "@/lib/labels";
import type { JobBrowseItem } from "@/types/domain";

export function JobsTable() {
  const items = useJobsStore((state) => state.items);
  const loading = useJobsStore((state) => state.loading);
  const error = useJobsStore((state) => state.error);
  const total = useJobsStore((state) => state.total);
  const page = useJobsStore((state) => state.page);
  const pageSize = PAGE_SIZE;
  const setPage = useJobsStore((state) => state.setPage);
  const navigate = useNavigate();
  const recordFromJob = useApplicationsStore((state) => state.recordFromJob);
  const setContext = useAssistantStore((state) => state.setContext);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const ask = (job: JobBrowseItem) => {
    setContext({ job_id: job.id, job_title: job.title, company_name: job.company_name, city: job.city });
    navigate(`/assistant?prompt=${encodeURIComponent(DEFAULT_QUESTIONS.recommendation_explanation)}`);
  };

  const record = async (job: JobBrowseItem) => {
    if (job.application_stage) {
      navigate("/applications");
      return;
    }
    try {
      const result = await recordFromJob(job.id);
      useJobsStore.setState((state) => ({
        items: state.items.map((item) =>
          item.id === job.id ? { ...item, application_stage: result.stage } : item,
        ),
      }));
    } catch (caught) {
      showToast(`记录投递失败：${(caught as Error).message}`, "error");
    }
  };

  return (
    <section className="workspace-section jobs-browser" aria-labelledby="all-jobs-heading">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">搜索、筛选与分页</p>
          <h3 id="all-jobs-heading">全部岗位</h3>
        </div>
        <span className="muted-label">
          {loading ? "加载中" : error ? "加载失败" : `${total} 个岗位`}
        </span>
      </div>
      <div className="table-scroll" data-state={error ? "error" : loading ? "loading" : "ready"}>
        <table className="data-table jobs-table">
          <thead>
            <tr>
              <th>公司</th>
              <th>岗位</th>
              <th>匹配度</th>
              <th>工作地点</th>
              <th>平台</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? <TableLoadingRow colSpan={6} /> : null}
            {!loading && error ? (
              <TableEmptyRow colSpan={6} message={`岗位加载失败：${error}`} />
            ) : null}
            {!loading && !error && items.length === 0 ? (
              <TableEmptyRow colSpan={6} message="没有符合当前条件的岗位" />
            ) : null}
            {items.map((job) => (
              <tr key={job.id}>
                <td>
                  <button
                    type="button"
                    className="table-link"
                    onClick={() => navigate(`/companies?q=${encodeURIComponent(job.company_name)}`)}
                  >
                    {job.company_name}
                  </button>
                </td>
                <td>
                  <button type="button" className="job-title-button" onClick={() => navigate(`/jobs/${encodeURIComponent(job.id)}`)}>
                    {job.title}
                  </button>
                  <div className="job-table-meta">
                    <span className="table-tag">{job.category_label}</span>
                    {(job.matched_directions ?? []).slice(0, 2).map((direction) => (
                      <span key={direction} className="table-tag table-tag--muted">
                        {direction}
                      </span>
                    ))}
                    {job.application_stage ? (
                      <span className="application-badge">
                        {applicationStageLabel(job.application_stage)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <ScoreBadge score={job.match_score} status={job.analysis_status} />
                </td>
                <td className="cell-muted">{text(job.city, "地点待确认")}</td>
                <td>
                  <span className="platform-badge">{job.platform}</span>
                </td>
                <td className="job-table-actions">
                  <div className="job-table-action-group">
                    <IconButton
                      icon="external"
                      small
                      label={`查看岗位详情：${job.title}`}
                      title="查看岗位详情"
                      onClick={() => navigate(`/jobs/${encodeURIComponent(job.id)}`)}
                    />
                    <Button variant="ghost" small onClick={() => ask(job)}>
                      询问助理
                    </Button>
                    <Button variant="secondary" small onClick={() => void record(job)}>
                      {job.application_stage ? "查看投递" : "记录投递"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        pages={pages}
        total={total}
        unit="条"
        onPrev={() => setPage(page - 1)}
        onNext={() => setPage(page + 1)}
      />
    </section>
  );
}
