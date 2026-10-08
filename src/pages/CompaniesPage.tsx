import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionHeading } from "@/components/ui/Section";
import { ScoreBadge, TableEmptyRow, TableLoadingRow } from "@/components/ui/States";
import { ExternalButton } from "@/components/ui/Button";
import { Pager } from "@/components/ui/Pager";
import { useJobsStore } from "@/stores/jobs";

const PAGE_SIZE = 30;

/** 公司排行视图（上游 #companies-view + renderCompanyRanking）。 */
export default function CompaniesPage() {
  const navigate = useNavigate();
  const summaries = useJobsStore((state) => state.companySummaries);
  const loadRanking = useJobsStore((state) => state.loadCompanyRankingOnly);
  const loading = useJobsStore((state) => state.loading);
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const search = params.get("q") ?? "";
  const sort = params.get("sort") ?? "score";

  useEffect(() => {
    if (!summaries.length) void loadRanking();
  }, [summaries.length, loadRanking]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = summaries.filter((company) => !query || company.name.toLowerCase().includes(query));
    return filtered.slice().sort((left, right) => {
      if (sort === "jobs") return right.job_count - left.job_count || left.name.localeCompare(right.name, "zh-CN");
      if (sort === "name") return left.name.localeCompare(right.name, "zh-CN");
      const l = left.average_score ?? -1;
      const r = right.average_score ?? -1;
      return r - l || right.job_count - left.job_count || left.name.localeCompare(right.name, "zh-CN");
    });
  }, [summaries, search, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="view-panel is-visible" data-view-panel="companies" aria-labelledby="companies-heading">
      <SectionHeading
        eyebrow="2027 届岗位覆盖"
        titleId="companies-heading"
        title="公司"
        description="查看全部来源公司，包括零岗位和失败记录，也可切换到已有岗位排行。"
      />
      <div className="company-browser-toolbar">
        <label className="search-field" htmlFor="company-search">
          <span className="sr-only">搜索公司</span>
          <input
            id="company-search"
            type="search"
            placeholder="搜索公司名称"
            autoComplete="off"
            value={search}
            onChange={(event) => {
              setParams({ q: event.target.value, sort });
              setPage(1);
            }}
          />
        </label>
        <label>
          <span className="sr-only">公司排序</span>
          <select
            id="company-sort"
            value={sort}
            onChange={(event) => {
              setParams({ q: search, sort: event.target.value });
              setPage(1);
            }}
          >
            <option value="score">平均匹配度</option>
            <option value="jobs">岗位数量</option>
            <option value="name">公司名称</option>
          </select>
        </label>
      </div>

      <section className="workspace-section" aria-labelledby="company-ranking-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">公司排行</p>
            <h3 id="company-ranking-heading">当前开放公司</h3>
          </div>
          <span className="muted-label">{loading && !summaries.length ? "加载中" : `${rows.length} 家公司`}</span>
        </div>
        <div className="table-scroll">
          <table className="data-table company-ranking-table">
            <thead>
              <tr>
                <th>公司</th>
                <th>岗位数</th>
                <th>平均匹配度</th>
                <th>最高分</th>
                <th>最高分岗位</th>
                <th>官网</th>
              </tr>
            </thead>
            <tbody>
              {loading && summaries.length === 0 ? <TableLoadingRow colSpan={6} /> : null}
              {!loading && pageRows.length === 0 ? (
                <TableEmptyRow colSpan={6} message="没有匹配的公司" />
              ) : null}
              {pageRows.map((company) => (
                <tr
                  key={company.key}
                  className="company-ranking-row"
                  onClick={() => navigate(`/jobs?company=${encodeURIComponent(company.key)}`)}
                >
                  <td>
                    <strong>{company.name}</strong>
                    {company.recruitment_units?.length ? (
                      <small className="company-units">{company.recruitment_units.join("、")}</small>
                    ) : null}
                  </td>
                  <td className="numeric-cell">{company.job_count}</td>
                  <td>
                    <ScoreBadge score={company.average_score == null ? null : Math.round(company.average_score)} />
                  </td>
                  <td>
                    <ScoreBadge score={company.top_score} />
                  </td>
                  <td className="cell-muted">{company.top_job || "尚未评分"}</td>
                  <td>
                    {company.campus_url ? (
                      <ExternalButton
                        href={company.campus_url}
                        title="打开校招官网"
                        ariaLabel={`打开 ${company.name} 校招官网`}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={safePage} pages={pages} total={rows.length} unit="家" onPrev={() => setPage(safePage - 1)} onNext={() => setPage(safePage + 1)} />
      </section>
    </section>
  );
}
