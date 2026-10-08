import { isoAt } from "./_clock";
import type { CompanySourceRecord } from "@/types/companySource";

/**
 * 公司来源登记 fixture：覆盖 SOURCE_STATUSES 里除 unusable 之外的全部状态
 * （unusable 被上游 list_sources 默认过滤，所以列表里看不到它）。
 */
interface SourceSeed extends Omit<CompanySourceRecord, "updated_at" | "last_attempt_at"> {
  attempt_offset: number;
}

const SEEDS: Array<Partial<SourceSeed> & Pick<CompanySourceRecord, "id" | "company_name" | "source" | "status">> = [
  {
    id: "src-offerbiu-tencent", company_name: "腾讯", source: "offerbiu", status: "complete",
    source_record_id: "ob-1001", company_id: "co-tencent",
    source_url: "https://join.qq.com", entry_url: "https://join.qq.com/post.html",
    original_entry_url: "https://join.qq.com/post.html",
    final_url: "https://join.qq.com/post.html?query=2027",
    job_count: 3, jd_pending_count: 0, last_success_job_count: 3, pagination_complete: true,
    reason_code: null, reason: null, failure_stage: null, attempt_offset: 0,
  },
  {
    id: "src-offerbiu-bytedance", company_name: "字节跳动", source: "offerbiu", status: "complete",
    source_record_id: "ob-1002", company_id: "co-bytedance",
    source_url: "https://jobs.bytedance.com", entry_url: "https://jobs.bytedance.com/campus/position",
    original_entry_url: "https://jobs.bytedance.com/campus/position",
    final_url: "https://jobs.bytedance.com/campus/position?contracts=campus",
    job_count: 3, jd_pending_count: 1, last_success_job_count: 3, pagination_complete: true,
    reason: null, failure_stage: null, attempt_offset: 0,
  },
  {
    id: "src-offerbiu-alibaba", company_name: "阿里巴巴", source: "offerbiu", status: "partial",
    source_record_id: "ob-1003", company_id: "co-alibaba",
    source_url: "https://talent.alibaba.com", entry_url: "https://talent.alibaba.com/campus/position",
    original_entry_url: "https://talent.alibaba.com/campus/position",
    final_url: "https://talent.alibaba.com/campus/position?batch=2027",
    job_count: 2, jd_pending_count: 1, last_success_job_count: 2, pagination_complete: false,
    reason_code: "pagination_truncated", reason: "分页在第 3 页后不再返回游标，已抓到的岗位可用。",
    failure_stage: "pagination", attempt_offset: -1,
  },
  {
    id: "src-offerbiu-meituan", company_name: "美团", source: "offerbiu", status: "running",
    source_record_id: "ob-1005", company_id: "co-meituan",
    source_url: "https://zhaopin.meituan.com", entry_url: "https://zhaopin.meituan.com/web/position",
    original_entry_url: "https://zhaopin.meituan.com/web/position",
    final_url: null, job_count: 0, jd_pending_count: 0, last_success_job_count: 1,
    pagination_complete: false, reason: "正在抓取岗位列表。", failure_stage: null, attempt_offset: 0,
  },
  {
    id: "src-offerbiu-huawei", company_name: "华为", source: "offerbiu", status: "failed",
    source_record_id: "ob-1004", company_id: "co-huawei",
    source_url: "https://career.huawei.com", entry_url: "https://career.huawei.com/campus/position",
    original_entry_url: "https://career.huawei.com/campus/position",
    final_url: "https://career.huawei.com/error", job_count: 0, jd_pending_count: 0,
    last_success_job_count: 2, pagination_complete: false,
    reason_code: "detail_page_timeout", reason: "职位详情页连续 3 次超时，需要人工确认入口是否变更。",
    failure_stage: "detail", attempt_offset: -2,
  },
  {
    id: "src-offerbiu-mihoyo", company_name: "米哈游", source: "offerbiu", status: "complete",
    source_record_id: "ob-1010", company_id: "co-mihoyo",
    source_url: "https://jobs.mihoyo.com", entry_url: "https://jobs.mihoyo.com/campus",
    original_entry_url: "https://jobs.mihoyo.com/campus", final_url: "https://jobs.mihoyo.com/campus/list",
    job_count: 1, jd_pending_count: 0, last_success_job_count: 1, pagination_complete: true,
    reason: null, failure_stage: null, attempt_offset: -3,
  },
  {
    id: "src-offerbiu-pdd", company_name: "拼多多", source: "offerbiu", status: "pending",
    source_record_id: "ob-1008", company_id: "co-pdd",
    source_url: null, entry_url: null, original_entry_url: null, final_url: null,
    job_count: 0, jd_pending_count: 0, last_success_job_count: 0, pagination_complete: false,
    reason_code: "entry_missing", reason: "来源侧未提供校招入口，需要人工补充入口地址。",
    failure_stage: "entry", attempt_offset: -4,
  },
  {
    id: "src-offerbiu-oppo", company_name: "OPPO", source: "offerbiu", status: "failed",
    source_record_id: "ob-1011", company_id: "co-oppo",
    source_url: "https://careers.oppo.com", entry_url: "https://careers.oppo.com/campus",
    original_entry_url: "https://careers.oppo.com/campus", final_url: "https://careers.oppo.com/campus",
    job_count: 0, jd_pending_count: 0, last_success_job_count: 0, pagination_complete: false,
    reason_code: "human_verification", reason: "站点要求人工验证，只读抓取无法继续。",
    failure_stage: "list", attempt_offset: -5,
  },
  {
    id: "src-offerbiu-kingsoft", company_name: "金山办公", source: "offerbiu", status: "complete",
    source_record_id: "ob-1012", company_id: "co-kingsoft",
    source_url: "https://wps.jobs", entry_url: "https://wps.jobs/campus/position",
    original_entry_url: "https://wps.jobs/campus/position", final_url: "https://wps.jobs/campus/position",
    job_count: 1, jd_pending_count: 0, last_success_job_count: 1, pagination_complete: true,
    reason: null, failure_stage: null, attempt_offset: -6,
  },
  {
    id: "src-offerbiu-jd", company_name: "京东", source: "offerbiu", status: "partial",
    source_record_id: "ob-1009", company_id: "co-jd",
    source_url: "https://campus.jd.com", entry_url: "https://campus.jd.com/#/jobs",
    original_entry_url: "https://campus.jd.com/#/jobs", final_url: "https://campus.jd.com/#/jobs",
    job_count: 1, jd_pending_count: 0, last_success_job_count: 1, pagination_complete: false,
    reason_code: "detail_partial", reason: "部分岗位详情接口返回空数组，已按可用数据处理。",
    failure_stage: "detail", attempt_offset: -7,
  },
];

export function buildCompanySources(): CompanySourceRecord[] {
  return SEEDS.map((seed) => ({
    source_record_id: null,
    source_url: null,
    company_id: null,
    entry_url: null,
    original_entry_url: null,
    final_url: null,
    failure_stage: null,
    reason_code: null,
    reason: null,
    job_count: 0,
    jd_pending_count: 0,
    last_success_job_count: 0,
    pagination_complete: false,
    ...seed,
    attempts: undefined,
    attempts_total: undefined,
    last_attempt_at: isoAt((seed as SourceSeed).attempt_offset ?? -1, 3, 20),
    updated_at: isoAt((seed as SourceSeed).attempt_offset ?? -1, 3, 45),
  })) as CompanySourceRecord[];
}
