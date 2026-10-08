import { useNavigate, useParams } from "react-router-dom";
import { Dialog } from "@/components/ui/Dialog";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingRows, ScoreBadge } from "@/components/ui/States";
import { batchLabel, compactDate, text } from "@/lib/format";
import { DEFAULT_QUESTIONS } from "@/lib/labels";
import { findBrowseJob, useJobsStore } from "@/stores/jobs";
import { useAssistantStore } from "@/stores/assistant";
import { useApplicationsStore } from "@/stores/applications";
import { showToast } from "@/stores/toast";
import { useEffect, useState } from "react";

/** 岗位详情弹层：路由 /jobs/:jobId（上游是同一个 dialog + openJobDetail）。 */
export default function JobDetailDialog() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const detail = useJobsStore((state) => state.detail);
  const loading = useJobsStore((state) => state.detailLoading);
  const error = useJobsStore((state) => state.detailError);
  const openDetail = useJobsStore((state) => state.openDetail);
  const closeDetail = useJobsStore((state) => state.closeDetail);
  const setContext = useAssistantStore((state) => state.setContext);
  const recordFromJob = useApplicationsStore((state) => state.recordFromJob);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    if (jobId) void openDetail(jobId);
    return closeDetail;
  }, [jobId, openDetail, closeDetail]);

  const job = detail?.job;
  const analysis = detail?.analysis ?? null;
  const browse = findBrowseJob(job?.id);

  const close = () => {
    closeDetail();
    navigate("/jobs", { replace: true });
  };

  return (
    <Dialog
      open
      onClose={close}
      labelledby="job-detail-title"
      kicker={browse?.company_name ?? job?.company_id ?? "岗位详情"}
      title={job?.title ?? "正在加载"}
      closeLabel="关闭岗位详情"
    >
      <div className="job-detail-content" data-state={loading ? "loading" : error ? "error" : "ready"}>
        {loading ? <LoadingRows rows={3} /> : null}
        {!loading && error ? <ErrorState title="岗位详情加载失败" detail={error} /> : null}
        {!loading && !error && !job ? <EmptyState title="岗位不存在" detail="它可能已被下架或从未抓取成功。" /> : null}
        {job ? (
          <>
            <div className="job-detail-meta">
              <span className="table-tag">{text(job.city, "地点待确认")}</span>
              <span className="table-tag">{batchLabel(job.batch)}</span>
              <span className="table-tag">{browse?.platform ?? "招聘官网"}</span>
              <span className="table-tag">{compactDate(job.first_seen_at, "发现日期待确认")}</span>
              <ScoreBadge score={job.match_score ?? analysis?.match_score} status={analysis?.analysis_status} />
            </div>

            {analysis ? (
              <section className="job-detail-section">
                <h3>岗位匹配</h3>
                {analysis.summary ? <p className="job-detail-summary">{analysis.summary}</p> : null}
                <div className="job-detail-analysis-grid">
                  <div className="job-analysis-block">
                    <strong className="analysis-block-title analysis-block-title--good">我的优势</strong>
                    <ul>
                      {(analysis.advantages ?? []).map((value) => <li key={value}>{value}</li>)}
                      {(analysis.advantages ?? []).length === 0 ? <li className="is-muted">暂无结构化信息</li> : null}
                    </ul>
                  </div>
                  <div className="job-analysis-block">
                    <strong className="analysis-block-title analysis-block-title--warn">需要补足</strong>
                    <ul>
                      {(analysis.gaps ?? []).map((value) => <li key={value}>{value}</li>)}
                      {(analysis.gaps ?? []).length === 0 ? <li className="is-muted">暂无结构化信息</li> : null}
                    </ul>
                  </div>
                </div>
                {analysis.model ? (
                  <p className="configuration-hint">
                    评分模型 {analysis.model} · 版本 {analysis.analysis_version ?? "—"} · 分析于{" "}
                    {compactDate(analysis.analyzed_at, "—")}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="job-detail-section">
              <h3>岗位说明</h3>
              <div className="job-jd">{job.jd_raw || "招聘页暂未提供完整岗位说明。"}</div>
            </section>

            <div className="job-detail-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setContext({ job_id: job.id, job_title: job.title, company_name: browse?.company_name ?? job.company_id, city: job.city });
                  close();
                  navigate(`/assistant?prompt=${encodeURIComponent(DEFAULT_QUESTIONS.recommendation_explanation)}`);
                }}
              >
                询问助理
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  if (browse?.application_stage || recorded) {
                    close();
                    navigate("/applications");
                    return;
                  }
                  try {
                    await recordFromJob(job.id);
                    setRecorded(true);
                  } catch (caught) {
                    showToast(`记录投递失败：${(caught as Error).message}`, "error");
                  }
                }}
              >
                {browse?.application_stage || recorded ? "查看投递" : "记录投递"}
              </Button>
              <LinkButton href={job.detail_url}>打开招聘页</LinkButton>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
