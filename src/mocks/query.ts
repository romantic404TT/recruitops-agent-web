/**
 * /api/jobs/browse 的查询引擎。
 * 语义按上游 `PostgresRecruitmentRepository.browse_jobs` 的对外契约重建：
 * 过滤 → 统计 → 分面 → 排序 → 分页；featured 取当前筛选结果里 70 分以上的前若干条。
 */
import { JOB_SEEDS, COMPANY_SEEDS } from "./data/jobs";
import { dateKey } from "./data/_clock";
import type {
  CompanyJobSummary,
  JobBrowseFacets,
  JobBrowseItem,
  JobBrowseStats,
} from "@/types/domain";

const EXCLUDED_STATUSES = new Set([
  "excluded",
  "direction_out",
  "doctorate_only",
  "internship",
  "cohort_unconfirmed",
]);

export interface BrowseParams {
  query?: string;
  company?: string;
  category?: string;
  platform?: string;
  evaluation?: string;
  score_band?: string;
  first_seen_on?: string;
  sort?: "score" | "newest" | "company";
  limit: number;
  offset: number;
}

/** 只有 complete 之外的一切状态都算「未评分」，与 stats.unscored 口径一致。 */
function isScored(item: JobBrowseItem): boolean {
  return item.analysis_status === "complete" && item.match_score != null;
}

function matchesEvaluation(item: JobBrowseItem, evaluation: string): boolean {
  switch (evaluation) {
    case "scored":
      return isScored(item);
    case "unscored":
      return !isScored(item);
    case "pending":
      return item.analysis_status === "pending" || item.analysis_status === "eligible";
    case "jd_incomplete":
      return item.analysis_status === "jd_incomplete";
    case "excluded":
      return EXCLUDED_STATUSES.has(String(item.analysis_status));
    default:
      return true;
  }
}

function matchesBand(item: JobBrowseItem, band: string): boolean {
  if (!band) return true;
  const score = item.match_score;
  if (score == null) return false;
  if (band === "high") return score >= 70;
  if (band === "medium") return score >= 60 && score < 70;
  return score < 60;
}

function matchesText(item: JobBrowseItem, needle: string): boolean {
  const value = needle.trim().toLowerCase();
  if (!value) return true;
  return [item.company_name, item.title, item.city ?? "", item.category_label, item.platform]
    .join(" ")
    .toLowerCase()
    .includes(value);
}

/** 上游默认把「被排除」的岗位挡在列表外（前端 visibleJobs 也再挡一次）。 */
function basePool(items: JobBrowseItem[]): JobBrowseItem[] {
  return items.filter((item) => !EXCLUDED_STATUSES.has(String(item.analysis_status ?? "")));
}

export function browseJobs(all: JobBrowseItem[], params: BrowseParams) {
  const pool = basePool(all);

  const filtered = pool.filter((item) => {
    if (params.query && !matchesText(item, params.query)) return false;
    if (params.company && (item.organization_id ?? item.company_id) !== params.company) return false;
    if (params.category && item.category !== params.category) return false;
    if (params.platform && item.platform !== params.platform) return false;
    if (params.evaluation && !matchesEvaluation(item, params.evaluation)) return false;
    if (!matchesBand(item, params.score_band ?? "")) return false;
    if (params.first_seen_on) {
      const seen = item.first_seen_at ? dateKey(new Date(item.first_seen_at)) : "";
      if (seen !== params.first_seen_on) return false;
    }
    return true;
  });

  const sorted = filtered.slice().sort((left, right) => {
    if (params.sort === "newest") {
      return String(right.first_seen_at ?? "").localeCompare(String(left.first_seen_at ?? ""));
    }
    if (params.sort === "company") {
      return (
        left.company_name.localeCompare(right.company_name, "zh-CN") ||
        String(right.match_score ?? -1).localeCompare(String(left.match_score ?? -1))
      );
    }
    const leftScore = left.match_score ?? -1;
    const rightScore = right.match_score ?? -1;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return String(right.first_seen_at ?? "").localeCompare(String(left.first_seen_at ?? ""));
  });

  const stats: JobBrowseStats = {
    jobs: filtered.length,
    companies: new Set(filtered.map((item) => item.organization_id ?? item.company_id)).size,
    high_match: filtered.filter((item) => (item.match_score ?? 0) >= 70).length,
    unscored: filtered.filter((item) => !isScored(item)).length,
    pending: filtered.filter(
      (item) => item.analysis_status === "pending" || item.analysis_status === "eligible",
    ).length,
    jd_incomplete: filtered.filter((item) => item.analysis_status === "jd_incomplete").length,
    excluded: pool.length - filtered.length,
  };

  // 分面始终基于「未被 company/category/platform/evaluation 收窄」的全量池，
  // 否则一旦选了某个公司，下拉框里就只剩它一家，用户无法回退。
  const facetPool = pool.filter((item) => {
    if (params.query && !matchesText(item, params.query)) return false;
    if (params.first_seen_on) {
      const seen = item.first_seen_at ? dateKey(new Date(item.first_seen_at)) : "";
      if (seen !== params.first_seen_on) return false;
    }
    if (!matchesBand(item, params.score_band ?? "")) return false;
    return true;
  });

  const groups = new Map<string, JobBrowseItem[]>();
  for (const item of facetPool) {
    const key = item.organization_id ?? item.company_id;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const companies: CompanyJobSummary[] = [...groups.entries()].map(([key, items]) => {
    const scored = items.filter(isScored);
    const top = scored.slice().sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))[0];
    const meta = COMPANY_SEEDS.find((company) => company.id === items[0].company_id);
    const unitNames = [...new Set(items.map((item) => item.company_name))];
    return {
      key,
      name: items[0].company_name,
      company_ids: [...new Set(items.map((item) => item.company_id))],
      recruitment_units: unitNames.length > 1 ? unitNames : meta ? [] : [],
      campus_url: meta?.campus_url ?? null,
      job_count: items.length,
      average_score: scored.length
        ? Math.round((scored.reduce((sum, item) => sum + (item.match_score ?? 0), 0) / scored.length) * 10) / 10
        : null,
      top_score: top?.match_score ?? null,
      top_job: top?.title ?? null,
    };
  });

  const categories: Record<string, string> = {};
  for (const item of facetPool) categories[item.category] = item.category_label;

  const facets: JobBrowseFacets = {
    companies,
    categories,
    platforms: [...new Set(facetPool.map((item) => item.platform))].sort((a, b) =>
      a.localeCompare(b, "zh-CN"),
    ),
  };

  const featured = filtered.filter((item) => (item.match_score ?? 0) >= 70).slice(0, 6);

  return {
    items: sorted.slice(params.offset, params.offset + params.limit),
    featured,
    total: filtered.length,
    limit: params.limit,
    offset: params.offset,
    stats,
    facets,
  };
}

/** 今日新增条数，用于 fixture 自检与 README 验收对照。 */
export const SEED_TODAY_COUNT = JOB_SEEDS.filter((seed) => seed.seen_day_offset === 0).length;
