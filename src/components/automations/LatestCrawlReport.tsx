import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { useSystemStore } from "@/stores/system";
import { postConfig } from "@/lib/http";
import { automationDateTime } from "@/lib/format";

interface CrawlFailure {
  company?: string;
  crawler_key?: string;
  type?: string;
  message?: string;
  recommendation?: string;
}

interface CrawlReport {
  run_at?: string;
  companies_checked?: number;
  new_jobs?: number;
  scored?: number;
  jd_pending?: number;
  failures?: CrawlFailure[];
}

/**
 * 最近一次抓取报告（上游 #latest-crawl-report，由 configuration.js:510 拉 /api/automations
 * 之外的 latest-crawl 接口填充）。抓不到就整块隐藏，和上游一致。
 */
export function LatestCrawlReport() {
  const report = useSystemStore((state) => state.operationalReport);
  const [payload, setPayload] = useState<{ found?: boolean; report?: CrawlReport | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    postConfig<{ found?: boolean; report?: CrawlReport | null }>("latest-crawl")
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch(() => {
        /* 上游这里静默失败，不显示报告块 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const navigate = useNavigate();
  const data = payload?.report ?? null;
  if (!payload?.found || !data) return null;

  const failures = data.failures ?? [];

  return (
    <section className="workspace-section" aria-live="polite">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">最近一次抓取</p>
          <h3>{automationDateTime(data.run_at, "时间待确认")}</h3>
        </div>
        <span className="muted-label">
          {`检查 ${data.companies_checked ?? "—"} 家 · 新增 ${data.new_jobs ?? 0} · 已评分 ${data.scored ?? 0} · 待补全 JD ${data.jd_pending ?? 0}`}
        </span>
      </div>
      {failures.length ? (
        <ul className="crawl-failure-list">
          {failures.map((failure, index) => (
            <li key={index}>
              <strong>{failure.company ?? failure.crawler_key ?? failure.type ?? "运行报告"}</strong>
              <span>{failure.message ?? "需要人工复核"}</span>
              {failure.recommendation ? (
                <Button variant="ghost" small onClick={() => navigate("/integrations")}>
                  {failure.recommendation}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="本轮没有失败项" detail="全部来源公司均正常返回。" />
      )}
      {report?.counts ? (
        <p className="configuration-hint">{`当前运营报告统计：异常 ${report.counts.crawler_issues ?? 0} 项`}</p>
      ) : null}
    </section>
  );
}
