/**
 * 岗位与公司 fixture。
 *
 * 全部字段严格对齐上游 Pydantic（packages/domain/models.py 的 JobBrowseItem / Job /
 * JobDetail / Company），因为 mock 层任何多写或漏写的字段都会让「换真后端」时立刻炸。
 *
 * 覆盖到的真实形态：
 * - 已评分（70+ / 60-69 / <60 三档）、待评分 eligible、待补全 JD、方向不符、博士限定
 *   —— 后两类会被前端 visibleJobs 过滤掉，用来验证过滤确实生效。
 * - 正式批 / 提前批；今日新增 与 历史新增（first_seen_at 决定）。
 */
import type {
  ApplicationStage,
  Company,
  Job,
  JobAnalysis,
  JobBrowseItem,
  RecruitmentBatch,
} from "@/types/domain";
import { audit, firstSeenToday, isoAt, today } from "./_clock";

export interface JobSeed {
  id: string;
  company_id: string;
  company_name: string;
  organization_id?: string;
  title: string;
  city: string | null;
  category: string;
  category_label: string;
  platform: string;
  batch: RecruitmentBatch;
  match_score: number | null;
  analysis_status: string | null;
  summary?: string;
  advantages?: string[];
  gaps?: string[];
  matched_directions?: string[];
  primary_match_direction?: string;
  recommendation?: string;
  seen_day_offset: number;
  application_stage?: ApplicationStage | null;
  capture_status?: string;
  capture_failure_reason?: string;
  jd?: string;
}

/** analysis_status 属于「被前端排除」的那几个值时，岗位不进任何列表。 */
export const JOB_SEEDS: JobSeed[] = [
  {
    id: "job-1001", company_id: "co-tencent", company_name: "腾讯", organization_id: "org-tencent",
    title: "后台开发工程师（校招提前批）", city: "深圳", category: "backend", category_label: "后端开发",
    platform: "腾讯招聘", batch: "early", match_score: 88, analysis_status: "complete",
    summary: "分布式服务与高并发场景与简历中的网关项目高度重合，学历要求匹配本科。",
    advantages: ["独立做过限流与熔断的网关组件", "有 Go 与 C++ 双语言项目经历", "竞赛经历与岗位技术要求一致"],
    gaps: ["缺少大规模在线服务的容量规划经验", "未体现 Kafka 等消息队列的实战"],
    matched_directions: ["服务端开发", "基础架构"], primary_match_direction: "服务端开发",
    recommendation: "优先投递：匹配度高且提前批竞争人数少于正式批。",
    seen_day_offset: 0, jd: "负责社交业务后端服务开发；要求扎实的计算机基础、熟悉 C++/Go 之一，有高并发系统设计经验者优先。",
  },
  {
    id: "job-1002", company_id: "co-bytedance", company_name: "字节跳动", organization_id: "org-bytedance",
    title: "后端开发工程师-基础架构", city: "北京", category: "backend", category_label: "后端开发",
    platform: "字节跳动招聘", batch: "formal", match_score: 84, analysis_status: "complete",
    summary: "岗位要求的服务治理能力与简历中的中间件实践对得上。",
    advantages: ["实现过服务注册与配置中心", "熟悉 RPC 框架原理"],
    gaps: ["没有 Kubernetes 生产环境经验"],
    matched_directions: ["基础架构"], primary_match_direction: "基础架构",
    recommendation: "建议投递：核心方向一致，需要在面试中补充容量规划案例。",
    seen_day_offset: 0, jd: "负责微服务治理平台建设，包括服务发现、配置中心、灰度发布等模块。",
  },
  {
    id: "job-1003", company_id: "co-alibaba", company_name: "阿里巴巴", organization_id: "org-alibaba",
    title: "数据研发工程师（提前批）", city: "杭州", category: "data", category_label: "数据研发",
    platform: "阿里巴巴集团招聘", batch: "early", match_score: 73, analysis_status: "complete",
    summary: "数仓建模经验匹配，但岗位偏离线链路，与实时方向的期望有偏差。",
    advantages: ["有完整的 Hive 数仓分层项目", "SQL 调优有量化结果"],
    gaps: ["未使用过 Flink 实时链路", "缺少数据治理相关实践"],
    matched_directions: ["数据研发"], primary_match_direction: "数据研发",
    recommendation: "可投递：匹配度中上，建议同时准备实时计算问题。",
    seen_day_offset: -2, application_stage: "written",
    jd: "负责离线数仓建模与数据治理，要求熟悉 Hadoop/Spark 生态。",
  },
  {
    id: "job-1004", company_id: "co-huawei", company_name: "华为", organization_id: "org-huawei",
    title: "软件工程师（Cloud BU）", city: "东莞", category: "backend", category_label: "后端开发",
    platform: "华为招聘", batch: "formal", match_score: 69, analysis_status: "complete",
    summary: "偏底层系统与网络协议，与简历的应用层经验只有部分重叠。",
    advantages: ["熟悉 Linux 系统编程", "有网络协议解析项目"],
    gaps: ["缺少 C 语言大型工程经验", "对 RDMA/DPDK 无接触"],
    matched_directions: ["系统软件"], primary_match_direction: "系统软件",
    seen_day_offset: -4,
    jd: "负责云计算底层软件研发，涉及虚拟化、网络与存储数据面。",
  },
  {
    id: "job-1005", company_id: "co-meituan", company_name: "美团", organization_id: "org-meituan",
    title: "前端开发工程师-到店事业群", city: "上海", category: "frontend", category_label: "前端开发",
    platform: "美团招聘", batch: "formal", match_score: 79, analysis_status: "complete",
    summary: "React 工程化与性能优化经验与岗位要求直接对应。",
    advantages: ["主导过首屏性能优化并量化收益", "有组件库维护经验"],
    gaps: ["缺少跨端（小程序/RN）实践"],
    matched_directions: ["前端开发"], primary_match_direction: "前端开发",
    recommendation: "建议投递：技术栈高度一致。",
    seen_day_offset: 0, application_stage: "interview1",
    jd: "负责到店业务的前端开发与工程化建设，熟悉 React、TypeScript 与构建工具链。",
  },
  {
    id: "job-1006", company_id: "co-netease", company_name: "网易", organization_id: "org-netease",
    title: "算法工程师-自然语言处理", city: "杭州", category: "algorithm", category_label: "算法",
    platform: "网易招聘", batch: "early", match_score: null, analysis_status: "eligible",
    summary: undefined, seen_day_offset: -1,
    jd: "面向游戏与教育场景的 NLP 算法研发。",
  },
  {
    id: "job-1007", company_id: "co-xiaomi", company_name: "小米", organization_id: "org-xiaomi",
    title: "嵌入式软件工程师", city: "武汉", category: "hardware", category_label: "硬件/嵌入式",
    platform: "小米招聘", batch: "formal", match_score: null, analysis_status: "jd_incomplete",
    seen_day_offset: -1, capture_status: "failed", capture_failure_reason: "detail_page_timeout",
    jd: null as unknown as string,
  },
  {
    id: "job-1008", company_id: "co-pdd", company_name: "拼多多", organization_id: "org-pdd",
    title: "测试开发工程师", city: "上海", category: "test", category_label: "测试开发",
    platform: "拼多多招聘", batch: "formal", match_score: 61, analysis_status: "complete",
    summary: "自动化框架经验匹配，但岗位更偏质量体系而非工具开发。",
    advantages: ["搭建过接口自动化框架"], gaps: ["缺少性能与稳定性专项经验"],
    matched_directions: ["质量保障"], primary_match_direction: "质量保障",
    seen_day_offset: -6,
    jd: "负责交易链路的测试平台与质量保障体系。",
  },
  {
    id: "job-1009", company_id: "co-jd", company_name: "京东", organization_id: "org-jd",
    title: "供应链数据分析师", city: "北京", category: "data", category_label: "数据分析",
    platform: "京东招聘", batch: "formal", match_score: 55, analysis_status: "complete",
    summary: "偏业务分析与指标体系，技术深度要求低于简历预期。",
    advantages: ["有指标体系建设经验"], gaps: ["缺少供应链领域知识"],
    matched_directions: ["数据分析"], primary_match_direction: "数据分析",
    seen_day_offset: -8,
    jd: "负责供应链域的数据分析与经营指标体系建设。",
  },
  {
    id: "job-1010", company_id: "co-tencent", company_name: "腾讯", organization_id: "org-tencent",
    title: "研究员-机器学习（博士专项）", city: "深圳", category: "algorithm", category_label: "算法",
    platform: "腾讯招聘", batch: "formal", match_score: null, analysis_status: "doctorate_only",
    seen_day_offset: -3, jd: "面向大模型的基础研究，要求博士学历。",
  },
  {
    id: "job-1011", company_id: "co-bytedance", company_name: "字节跳动", organization_id: "org-bytedance",
    title: "日常实习生-后端", city: "北京", category: "backend", category_label: "后端开发",
    platform: "字节跳动招聘", batch: "internship", match_score: null, analysis_status: "internship",
    seen_day_offset: -3, jd: "面向在校生的日常实习岗位，非校招批次。",
  },
  {
    id: "job-1012", company_id: "co-mihoyo", company_name: "米哈游", organization_id: "org-mihoyo",
    title: "游戏服务器开发工程师", city: "上海", category: "backend", category_label: "后端开发",
    platform: "米哈游招聘", batch: "formal", match_score: 82, analysis_status: "complete",
    summary: "实时同步与帧同步经验与岗位要求契合，学历与城市均在目标范围。",
    advantages: ["实现过状态同步 Demo", "熟悉 C++ 与性能剖析"],
    gaps: ["没有大型项目协作经验"],
    matched_directions: ["服务端开发", "游戏开发"], primary_match_direction: "服务端开发",
    recommendation: "优先投递。", seen_day_offset: 0,
    jd: "负责游戏服务端逻辑、同步方案与性能优化。",
  },
  {
    id: "job-1013", company_id: "co-oppo", company_name: "OPPO", organization_id: "org-oppo",
    title: "Android 开发工程师", city: "成都", category: "mobile", category_label: "移动端",
    platform: "OPPO 招聘", batch: "formal", match_score: 66, analysis_status: "complete",
    summary: "客户端经验匹配但简历以服务端为主，属于方向外探索。",
    advantages: ["有 Kotlin 个人项目"], gaps: ["缺少 Android 组件与性能优化实战"],
    matched_directions: ["移动端"], primary_match_direction: "移动端",
    seen_day_offset: -5, jd: "负责系统应用层的 Android 开发。",
  },
  {
    id: "job-1014", company_id: "co-kingsoft", company_name: "金山办公", organization_id: "org-kingsoft",
    title: "C++ 研发工程师（提前批）", city: "武汉", category: "backend", category_label: "后端开发",
    platform: "金山办公招聘", batch: "early", match_score: 76, analysis_status: "complete",
    summary: "Office 内核大量使用 C++，与简历中的系统编程项目相关。",
    advantages: ["C++ 项目有内存与并发实践"], gaps: ["缺少大型单体代码库经验"],
    matched_directions: ["客户端研发", "系统软件"], primary_match_direction: "系统软件",
    seen_day_offset: 0, jd: "负责文档内核的 C++ 模块研发与性能优化。",
  },
  {
    id: "job-1015", company_id: "co-alibaba", company_name: "阿里巴巴", organization_id: "org-alibaba",
    title: "算法工程师-搜索推荐", city: "北京", category: "algorithm", category_label: "算法",
    platform: "阿里巴巴集团招聘", batch: "formal", match_score: null, analysis_status: "direction_out",
    seen_day_offset: -7, jd: "搜索与推荐算法研发，要求顶会论文或竞赛金牌。",
  },
  {
    id: "job-1016", company_id: "co-senseTime", company_name: "商汤科技", organization_id: "org-senseTime",
    title: "深度学习推理优化工程师", city: "上海", category: "algorithm", category_label: "算法",
    platform: "商汤科技招聘", batch: "formal", match_score: 71, analysis_status: "complete",
    summary: "推理加速与算子优化方向有部分匹配，缺少 CUDA 实战。",
    advantages: ["了解量化与剪枝方法"], gaps: ["无 CUDA/TensorRT 项目"],
    matched_directions: ["基础架构", "算法"], primary_match_direction: "基础架构",
    seen_day_offset: -9, jd: "负责模型推理引擎的算子优化与部署。",
  },
  {
    id: "job-1017", company_id: "co-huawei", company_name: "华为", organization_id: "org-huawei",
    title: "AI 平台开发工程师", city: "西安", category: "backend", category_label: "后端开发",
    platform: "华为招聘", batch: "formal", match_score: 74, analysis_status: "complete",
    summary: "平台工程方向匹配，西安地点符合志愿。",
    advantages: ["有训练平台相关组件经验"], gaps: ["对昇腾生态不熟悉"],
    matched_directions: ["基础架构"], primary_match_direction: "基础架构",
    seen_day_offset: 0,
    jd: "负责 AI 训练与推理平台的工程化建设。",
  },
  {
    id: "job-1018", company_id: "co-nio", company_name: "蔚来", organization_id: "org-nio",
    title: "车联网云平台开发工程师", city: "上海", category: "backend", category_label: "后端开发",
    platform: "蔚来招聘", batch: "formal", match_score: 68, analysis_status: "complete",
    summary: "车联业务偏硬件协议，与互联网后端经验部分重合。",
    advantages: ["熟悉 IoT 协议栈概念"], gaps: ["无车载领域经验"],
    matched_directions: ["服务端开发"], primary_match_direction: "服务端开发",
    seen_day_offset: -11, jd: "负责车联网云端服务与数据链路。",
  },
  {
    id: "job-1019", company_id: "co-tencent", company_name: "腾讯", organization_id: "org-tencent",
    title: "产品经理（技术方向）", city: "广州", category: "product", category_label: "产品",
    platform: "腾讯招聘", batch: "formal", match_score: 42, analysis_status: "complete",
    summary: "技术背景有助于沟通，但岗位核心能力是需求与商业化判断。",
    advantages: ["能读懂技术方案"], gaps: ["无产品实习或完整需求交付经历"],
    matched_directions: ["产品"], primary_match_direction: "产品",
    seen_day_offset: -12, jd: "负责某条业务线的产品规划与需求落地。",
  },
  {
    id: "job-1020", company_id: "co-bytedance", company_name: "字节跳动", organization_id: "org-bytedance",
    title: "数据工程师-数仓", city: "上海", category: "data", category_label: "数据研发",
    platform: "字节跳动招聘", batch: "formal", match_score: null, analysis_status: "pending",
    seen_day_offset: 0,
    jd: "负责电商业务的数据仓库建模与 ETL 链路建设。",
  },
];

export const COMPANY_SEEDS: Array<{
  id: string;
  name: string;
  crawler_key: string | null;
  integration_status: string;
  campus_url: string | null;
  aliases?: string[];
}> = [
  { id: "co-tencent", name: "腾讯", crawler_key: "tencent", integration_status: "connected", campus_url: "https://join.qq.com" },
  { id: "co-bytedance", name: "字节跳动", crawler_key: "bytedance", integration_status: "connected", campus_url: "https://jobs.bytedance.com", aliases: ["今日头条"] },
  { id: "co-alibaba", name: "阿里巴巴", crawler_key: "alibaba", integration_status: "connected", campus_url: "https://talent.alibaba.com", aliases: ["阿里", "阿里巴巴集团"] },
  { id: "co-huawei", name: "华为", crawler_key: null, integration_status: "pending", campus_url: "https://career.huawei.com" },
  { id: "co-meituan", name: "美团", crawler_key: "meituan", integration_status: "connected", campus_url: "https://zhaopin.meituan.com" },
  { id: "co-netease", name: "网易", crawler_key: "netease", integration_status: "connected", campus_url: "https://campus.163.com" },
  { id: "co-xiaomi", name: "小米", crawler_key: null, integration_status: "unusable", campus_url: "https://hr.xiaomi.com" },
  { id: "co-pdd", name: "拼多多", crawler_key: "pdd", integration_status: "connected", campus_url: null },
  { id: "co-jd", name: "京东", crawler_key: "jd", integration_status: "connected", campus_url: "https://campus.jd.com" },
  { id: "co-mihoyo", name: "米哈游", crawler_key: "mihoyo", integration_status: "connected", campus_url: "https://jobs.mihoyo.com" },
  { id: "co-oppo", name: "OPPO", crawler_key: null, integration_status: "pending", campus_url: "https://careers.oppo.com" },
  { id: "co-kingsoft", name: "金山办公", crawler_key: "kingsoft", integration_status: "connected", campus_url: "https://.wps.cn/campus" },
  { id: "co-senseTime", name: "商汤科技", crawler_key: null, integration_status: "blocked", campus_url: "https://www.sensetime.com/careers" },
  { id: "co-nio", name: "蔚来", crawler_key: null, integration_status: "pending", campus_url: "https://campus.nio.com" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  backend: "后端开发",
  frontend: "前端开发",
  data: "数据研发",
  algorithm: "算法",
  hardware: "硬件/嵌入式",
  mobile: "移动端",
  test: "测试开发",
  product: "产品",
};

export const PLATFORMS: string[] = Array.from(
  new Set(JOB_SEEDS.map((seed) => seed.platform)),
);

export function toBrowseItem(seed: JobSeed): JobBrowseItem {
  return {
    id: seed.id,
    company_id: seed.company_id,
    company_name: seed.company_name,
    organization_id: seed.organization_id ?? seed.company_id,
    title: seed.title,
    city: seed.city,
    detail_url: `https://example-campus.test/jobs/${seed.id}`,
    category: seed.category,
    category_label: seed.category_label,
    platform: seed.platform,
    batch: seed.batch,
    capture_status: seed.capture_status ?? "complete",
    capture_failure_reason: seed.capture_failure_reason ?? "",
    availability_status: "active",
    match_score: seed.match_score,
    recommendation: seed.recommendation ?? null,
    summary: seed.summary ?? null,
    advantages: seed.advantages ?? [],
    gaps: seed.gaps ?? [],
    matched_directions: seed.matched_directions ?? [],
    primary_match_direction: seed.primary_match_direction ?? null,
    analysis_status: seed.analysis_status,
    first_seen_at:
      seed.seen_day_offset === 0
        ? firstSeenToday(8, (JOB_SEEDS.indexOf(seed) % 10) + 1)
        : isoAt(seed.seen_day_offset, 10, 15),
    application_stage: seed.application_stage ?? null,
  };
}

export function toJob(seed: JobSeed): Job {
  return {
    ...audit(seed.seen_day_offset - 10),
    id: seed.id,
    company_id: seed.company_id,
    title: seed.title,
    city: seed.city,
    detail_url: `https://example-campus.test/jobs/${seed.id}`,
    jd_raw: seed.jd ?? null,
    cohort: 2027,
    cohort_status: "confirmed",
    batch: seed.batch,
    match_score: seed.match_score,
    first_seen_at: toBrowseItem(seed).first_seen_at ?? null,
    last_seen_at: isoAt(0, 6, 0),
    organization_id: seed.organization_id ?? seed.company_id,
    recruitment_unit_id: null,
    recruitment_campaign_id: null,
    source_platform: seed.platform,
    source_tenant: null,
    native_job_id: seed.id.replace("job-", ""),
    normalized_detail_url: `https://example-campus.test/jobs/${seed.id}`,
    business_key: `${seed.company_id}:${seed.id}`,
    capture_status: seed.capture_status ?? "complete",
    capture_failure_reason: seed.capture_failure_reason ?? "",
    availability_status: "active",
    title_key: seed.title,
    capture_evidence: { observed_at: isoAt(0, 6, 0), source: "recruitops-mock" },
  };
}

export function toAnalysis(seed: JobSeed): JobAnalysis | null {
  if (!seed.analysis_status || seed.analysis_status === "pending") return null;
  return {
    match_score: seed.match_score,
    advantages: seed.advantages ?? [],
    gaps: seed.gaps ?? [],
    summary: seed.summary ?? null,
    recommendation: seed.recommendation ?? null,
    score_breakdown: seed.match_score
      ? { skill: Math.round(seed.match_score * 0.45), project: Math.round(seed.match_score * 0.35), education: Math.round(seed.match_score * 0.2) }
      : {},
    evidence: seed.advantages?.length
      ? [{ field: "projects", quote: seed.advantages[0], where: "简历项目段" }]
      : [],
    evidence_level: seed.match_score ? "strong" : "weak",
    matched_directions: seed.matched_directions ?? [],
    primary_match_direction: seed.primary_match_direction ?? null,
    analysis_status: seed.analysis_status,
    model: "mock-deepseek-chat",
    analysis_version: "v3",
    prompt_version: "match-prompt-2026-09",
    content_fingerprint: `fp-${seed.id}`,
    profile_fingerprint: "fp-profile-001",
    input_tokens: seed.match_score ? 1420 : null,
    output_tokens: seed.match_score ? 260 : null,
    filter_reasons: [],
    refusal_reason: null,
    error_code: null,
    analyzed_at: isoAt(seed.seen_day_offset, 11, 30),
  };
}

export function buildCompanies(): Company[] {
  return COMPANY_SEEDS.map((seed, index) => ({
    ...audit(-30 + index),
    id: seed.id,
    name: seed.name,
    aliases: seed.aliases ?? [],
    campus_url: seed.campus_url,
    crawler_key: seed.crawler_key,
    integration_status: seed.integration_status,
    organization_id: seed.id.replace("co-", "org-"),
    recruitment_unit_name: seed.name,
    source_identity: seed.crawler_key ? `${seed.crawler_key}:group` : null,
  }));
}

/** 今日新增数量，供 fixture 自检与 README 的验收清单对照。 */
export const TODAY_SEEN_COUNT = JOB_SEEDS.filter(
  (seed) => seed.seen_day_offset === 0,
).length;

export const TODAY_KEY = today();
