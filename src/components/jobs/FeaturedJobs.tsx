import { useNavigate } from "react-router-dom";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState, LoadingRows, ScoreBadge } from "@/components/ui/States";
import { applicationStageLabel, text } from "@/lib/format";
import { DEFAULT_QUESTIONS } from "@/lib/labels";
import { useJobsStore } from "@/stores/jobs";
import { useAssistantStore } from "@/stores/assistant";

/** 高匹配岗位卡（<details> 折叠「展开匹配分析」，与上游一致）。 */
export function FeaturedJobs() {
  const featured = useJobsStore((state) => state.featured);
  const loading = useJobsStore((state) => state.loading);
  const navigate = useNavigate();
  const setContext = useAssistantStore((state) => state.setContext);

  return (
    <details className="workspace-section featured-jobs-section">
      <summary className="featured-group-summary">
        <h3 id="featured-jobs-heading">高匹配岗位</h3>
        <span className="muted-label">{loading ? "加载中" : `${featured.length} 个岗位`}</span>
        <span className="featured-group-hint">展开查看岗位与匹配分析</span>
      </summary>
      <div className="featured-job-list" data-state={loading ? "loading" : "ready"}>
        {loading && featured.length === 0 ? <LoadingRows rows={3} /> : null}
        {!loading && featured.length === 0 ? (
          <EmptyState title="暂无高匹配岗位" detail="当前范围内没有 70 分及以上的岗位。" />
        ) : null}
        {featured.map((job) => (
          <article key={job.id} className="featured-job-card">
            <div className="featured-job-header">
              <div className="featured-job-identity">
                <button
                  type="button"
                  className="table-link"
                  onClick={() => navigate(`/companies?q=${encodeURIComponent(job.company_name)}`)}
                >
                  {job.company_name}
                </button>
                <h4 className="featured-job-title">{job.title}</h4>
                <div className="featured-job-meta">
                  {`${text(job.city, "地点待确认")} · ${job.category_label} · ${job.platform}`}
                </div>
              </div>
              <ScoreBadge large score={job.match_score} status={job.analysis_status} />
            </div>
            <div className="featured-job-actions">
              {job.application_stage ? (
                <span className="application-badge">{applicationStageLabel(job.application_stage)}</span>
              ) : null}
              <Button variant="ghost" onClick={() => navigate(`/jobs/${encodeURIComponent(job.id)}`)}>
                查看详情
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setContext({ job_id: job.id, job_title: job.title, company_name: job.company_name });
                  navigate(`/assistant?prompt=${encodeURIComponent(DEFAULT_QUESTIONS.recommendation_explanation)}`);
                }}
              >
                询问助理
              </Button>
              <LinkButton href={job.detail_url}>打开招聘页</LinkButton>
            </div>
            <details className="featured-job-disclosure">
              <summary>展开匹配分析 · 优势与不足</summary>
              <p className="featured-job-summary">
                {job.summary || "该岗位尚无分析摘要，可打开详情查看完整 JD。"}
              </p>
              <div className="featured-job-comparison">
                <div className="job-analysis-block">
                  <strong className="analysis-block-title analysis-block-title--good">我的优势</strong>
                  <ul>
                    {(job.advantages ?? []).slice(0, 3).map((value) => (
                      <li key={value}>{value}</li>
                    ))}
                    {(job.advantages ?? []).length === 0 ? <li className="is-muted">暂无结构化优势</li> : null}
                  </ul>
                </div>
                <div className="job-analysis-block">
                  <strong className="analysis-block-title analysis-block-title--warn">需要补足</strong>
                  <ul>
                    {(job.gaps ?? []).slice(0, 3).map((value) => (
                      <li key={value}>{value}</li>
                    ))}
                    {(job.gaps ?? []).length === 0 ? <li className="is-muted">未发现明确短板</li> : null}
                  </ul>
                </div>
              </div>
            </details>
          </article>
        ))}
      </div>
    </details>
  );
}
