import { MetricItem } from "@/components/ui/Section";
import { UiIcon } from "@/components/ui/UiIcon";
import { useJobsStore } from "@/stores/jobs";

/**
 * 岗位页四个摘要指标。文案与上游 renderJobStats 一致，
 * 「待评分」下面那行 detail 显示的是待补全 JD 的数量。
 */
export function JobMetrics() {
  const stats = useJobsStore((state) => state.stats);
  return (
    <div className="metric-grid jobs-metric-grid" aria-label="岗位摘要">
      <MetricItem
        icon={<UiIcon name="briefcase" />}
        iconTone="jobs"
        label="岗位总数"
        value={stats?.jobs ?? "—"}
        detail="已确认 2027 届"
      />
      <MetricItem
        icon={<UiIcon name="company" />}
        iconTone="companies"
        label="覆盖公司"
        value={stats?.companies ?? "—"}
        detail="按集团归并"
      />
      <MetricItem
        icon={<UiIcon name="star" />}
        iconTone="match"
        label="高匹配"
        value={stats?.high_match ?? "—"}
        detail="70 分及以上"
      />
      <MetricItem
        icon={<UiIcon name="clock" />}
        iconTone="pending"
        label="待评分"
        value={stats?.pending ?? 0}
        detail={`待补全 JD ${stats?.jd_incomplete ?? 0}`}
      />
    </div>
  );
}
