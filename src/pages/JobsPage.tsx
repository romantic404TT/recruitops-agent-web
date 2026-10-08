import { useCallback, useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import { Button, IconButton } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/Pager";
import { JobMetrics } from "@/components/jobs/JobMetrics";
import { JobFilterBar } from "@/components/jobs/JobFilterBar";
import { JobsTable } from "@/components/jobs/JobsTable";
import { FeaturedJobs } from "@/components/jobs/FeaturedJobs";
import { useJobsStore, type JobBrowseMode } from "@/stores/jobs";

/** 岗位视图（上游 #jobs-view，index.html:246-308）。 */
export default function JobsPage() {
  const mode = useJobsStore((state) => state.mode);
  const setMode = useJobsStore((state) => state.setMode);
  const load = useJobsStore((state) => state.load);
  const reload = useCallback(() => void load({ refreshFeatured: true }), [load]);

  useEffect(() => {
    reload();
  }, [mode, reload]);

  const [params] = useSearchParams();
  useEffect(() => {
    if (params.get("mode") === "today") setMode("today");
  }, [params, setMode]);

  return (
    <section className="view-panel is-visible" data-view-panel="jobs" aria-labelledby="jobs-heading">
      <SectionHeading
        titleId="jobs-heading"
        title={mode === "today" ? "今日新增岗位" : "27届校招岗位"}
        description={
          mode === "today"
            ? "今天首次发现并确认的 27 届正式批和提前批岗位。"
            : "已确认的正式批和提前批岗位，高匹配岗位优先展示。"
        }
        actions={
          <>
            <SegmentedControl<JobBrowseMode>
              ariaLabel="岗位时间范围"
              value={mode}
              onChange={setMode}
              options={[
                { value: "all", label: "全部 27 届" },
                { value: "today", label: "今日新增" },
              ]}
            />
            <IconButton
              icon="refresh"
              label="刷新岗位"
              title="刷新岗位"
              onClick={() => void load({ refreshFeatured: true })}
            />
          </>
        }
      />

      <div className="source-note" role="note" aria-label="岗位数据来源">
        <strong>数据来源</strong>
        <span>
          公司发现来自 OfferBiu，岗位与评分读取 RecruitOps 本地 PostgreSQL；投递记录独立保留，不会实时读取原秋招系统。
        </span>
      </div>

      <JobMetrics />
      <FeaturedJobs />
      <JobFilterBar onSearch={reload} />
      <JobsTable />
      {/* 岗位详情走 /jobs/:jobId 模态路由，列表留在底层 */}
      <Outlet />
      <Button variant="ghost" onClick={() => setMode("all")} hidden>
        返回原列表
      </Button>
    </section>
  );
}
