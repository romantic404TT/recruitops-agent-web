import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useJobsStore, type JobFilters } from "@/stores/jobs";

/**
 * 岗位筛选条。上游下拉选项是 facets 动态灌进去的（replaceSelectOptions），
 * 这里同样读 store.facets；只有 mock 的 company 分面在 facet 请求用 limit=1 时
 * 也会返回全量公司，所以不需要额外兜底。
 */
export function JobFilterBar({ onSearch }: { onSearch: () => void }) {
  const filters = useJobsStore((state) => state.filters);
  const facets = useJobsStore((state) => state.facets);
  const setFilter = useJobsStore((state) => state.setFilter);
  const resetFilters = useJobsStore((state) => state.resetFilters);
  const formRef = useRef<HTMLFormElement>(null);

  // 搜索框防抖：上游是 change 事件即时触发，这里保留同样的即时语义，
  // 只在 query 字段上做 300ms 防抖，避免逐字打接口。
  useEffect(() => {
    const timer = window.setTimeout(onSearch, 300);
    return () => window.clearTimeout(timer);
    // 只在 query 变化时防抖重查，其它筛选项走 onChange 立即查。
  }, [filters.query, onSearch]);

  const patch = (key: keyof JobFilters, value: string) => setFilter({ [key]: value });

  return (
    <form
      className="job-filter-bar"
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <label className="search-field" htmlFor="job-search">
        <span className="sr-only">搜索岗位</span>
        <input
          id="job-search"
          type="search"
          placeholder="搜索公司、岗位或地点"
          autoComplete="off"
          value={filters.query}
          onChange={(event) => patch("query", event.target.value)}
        />
      </label>
      <label>
        <span className="sr-only">公司</span>
        <select value={filters.company} onChange={(event) => { patch("company", event.target.value); onSearch(); }}>
          <option value="">全部公司</option>
          {facets.companies.map((company) => (
            <option key={company.key} value={company.key}>
              {company.name} ({company.job_count})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">岗位类型</span>
        <select value={filters.category} onChange={(event) => { patch("category", event.target.value); onSearch(); }}>
          <option value="">全部岗位类型</option>
          {Object.entries(facets.categories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">招聘平台</span>
        <select value={filters.platform} onChange={(event) => { patch("platform", event.target.value); onSearch(); }}>
          <option value="">全部平台</option>
          {facets.platforms.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">评分状态</span>
        <select value={filters.evaluation} onChange={(event) => { patch("evaluation", event.target.value); onSearch(); }}>
          <option value="">全部评分状态</option>
          <option value="scored">已评分</option>
          <option value="pending">待评分</option>
          <option value="jd_incomplete">待补全 JD</option>
          <option value="unscored">所有未评分</option>
        </select>
      </label>
      <label>
        <span className="sr-only">匹配分数</span>
        <select value={filters.score_band} onChange={(event) => { patch("score_band", event.target.value); onSearch(); }}>
          <option value="">不限分数</option>
          <option value="high">70 分及以上</option>
          <option value="medium">60 至 69 分</option>
          <option value="low">60 分以下</option>
        </select>
      </label>
      <label>
        <span className="sr-only">排序方式</span>
        <select value={filters.sort} onChange={(event) => { patch("sort", event.target.value); onSearch(); }}>
          <option value="score">匹配度优先</option>
          <option value="newest">最新发现</option>
          <option value="company">按公司</option>
        </select>
      </label>
      <Button
        variant="ghost"
        type="reset"
        onClick={() => {
          resetFilters();
          if (formRef.current) formRef.current.reset();
          onSearch();
        }}
      >
        重置
      </Button>
      {/* 分面尚未返回时下拉框只有默认项，加载完成后自动补齐 */}
    </form>
  );
}
