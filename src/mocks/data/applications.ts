import { audit, dateOffsetKey, isoAt } from "./_clock";
import type {
  Application,
  ApplicationStage,
  ScheduleEvent,
  StageHistoryEntry,
} from "@/types/domain";

/** 看板 5 列都要有数据，且要能体现「卡面只看结果」。 */
interface ApplicationSeed {
  id: string;
  company_name: string;
  job_title: string;
  job_id?: string | null;
  stage: ApplicationStage;
  record_url?: string | null;
  note?: string | null;
  result?: string;
  history: Array<{ stage: ApplicationStage; result?: string; day_offset: number; source: string }>;
  updated_day_offset: number;
}

const APPLICATION_SEEDS: ApplicationSeed[] = [
  {
    id: "app-2001", company_name: "腾讯", job_title: "后台开发工程师（校招提前批）", job_id: "job-1001",
    stage: "applied", record_url: "https://join.qq.com/progress/2001", note: "提前批第一志愿，希望走深圳。",
    result: "进行中", updated_day_offset: -1,
    history: [
      { stage: "interested", day_offset: -12, source: "manual" },
      { stage: "applied", result: "进行中", day_offset: -9, source: "recruitment_mail:confirmation" },
    ],
  },
  {
    id: "app-2002", company_name: "字节跳动", job_title: "后端开发工程师-基础架构", job_id: "job-1002",
    stage: "assessment", record_url: "https://jobs.bytedance.com/campus/progress/2002",
    result: "待", updated_day_offset: -2,
    history: [
      { stage: "applied", day_offset: -10, source: "manual" },
      { stage: "assessment", result: "待", day_offset: -2, source: "edge:application_status_review" },
    ],
  },
  {
    id: "app-2003", company_name: "美团", job_title: "前端开发工程师-到店事业群", job_id: "job-1005",
    stage: "written", record_url: null, note: "笔试链接在邮件里，已加入日程。",
    result: "进行中", updated_day_offset: -3,
    history: [
      { stage: "applied", day_offset: -15, source: "manual" },
      { stage: "assessment", day_offset: -7, source: "recruitment_mail:assessment" },
      { stage: "written", result: "进行中", day_offset: -3, source: "recruitment_mail:written_test" },
    ],
  },
  {
    id: "app-2004", company_name: "米哈游", job_title: "游戏服务器开发工程师", job_id: "job-1012",
    stage: "interview1", record_url: null,
    result: "进行中", updated_day_offset: -1,
    history: [
      { stage: "applied", day_offset: -18, source: "manual" },
      { stage: "written", day_offset: -8, result: "通过", source: "edge" },
      { stage: "interview1", result: "进行中", day_offset: -1, source: "recruitment_mail:interview" },
    ],
  },
  {
    id: "app-2005", company_name: "金山办公", job_title: "C++ 研发工程师（提前批）", job_id: "job-1014",
    stage: "interview2", record_url: null, note: "二面重点问内存与并发。",
    result: "进行中", updated_day_offset: -4,
    history: [
      { stage: "interview1", day_offset: -11, result: "通过", source: "manual" },
      { stage: "interview2", result: "进行中", day_offset: -4, source: "edge:application_status_review" },
    ],
  },
  {
    id: "app-2006", company_name: "华为", job_title: "AI 平台开发工程师", job_id: "job-1017",
    stage: "hr", record_url: null, result: "进行中", updated_day_offset: -5,
    history: [
      { stage: "interview2", day_offset: -16, result: "通过", source: "manual" },
      { stage: "hr", result: "进行中", day_offset: -5, source: "recruitment_mail:interview" },
    ],
  },
  {
    id: "app-2007", company_name: "商汤科技", job_title: "深度学习推理优化工程师", job_id: "job-1016",
    stage: "offer", record_url: null, note: "已拿到意向书，考虑城市因素。",
    result: "通过", updated_day_offset: -6,
    history: [
      { stage: "interview2", day_offset: -20, result: "通过", source: "manual" },
      { stage: "offer", result: "通过", day_offset: -6, source: "recruitment_mail:offer" },
    ],
  },
  {
    id: "app-2008", company_name: "拼多多", job_title: "测试开发工程师", job_id: "job-1008",
    stage: "rejected", record_url: null, result: "淘汰", updated_day_offset: -7,
    history: [
      { stage: "written", day_offset: -14, source: "manual" },
      { stage: "rejected", result: "淘汰", day_offset: -7, source: "recruitment_mail:rejection" },
    ],
  },
  {
    id: "app-2009", company_name: "京东", job_title: "供应链数据分析师", job_id: "job-1009",
    stage: "withdrawn", record_url: null, note: "方向偏离，主动撤回。",
    result: "放弃", updated_day_offset: -9,
    history: [
      { stage: "applied", day_offset: -22, source: "manual" },
      { stage: "withdrawn", result: "放弃", day_offset: -9, source: "manual" },
    ],
  },
  {
    id: "app-2010", company_name: "蔚来", job_title: "车联网云平台开发工程师", job_id: "job-1018",
    stage: "interested", record_url: null, result: "待", updated_day_offset: -1,
    history: [{ stage: "interested", result: "待", day_offset: -1, source: "manual" }],
  },
  {
    id: "app-2011", company_name: "阿里巴巴", job_title: "数据研发工程师（提前批）", job_id: "job-1003",
    stage: "written", record_url: "https://talent.alibaba.com/campus/progress/2011",
    result: "进行中", updated_day_offset: -2,
    history: [
      { stage: "applied", day_offset: -13, source: "manual" },
      { stage: "written", result: "进行中", day_offset: -2, source: "edge:application_status_review" },
    ],
  },
  {
    id: "app-2012", company_name: "OPPO", job_title: "Android 开发工程师", job_id: "job-1013",
    stage: "applied", record_url: null, result: "进行中", updated_day_offset: -3,
    history: [{ stage: "applied", result: "进行中", day_offset: -3, source: "manual" }],
  },
];

export function buildApplications(): Application[] {
  return APPLICATION_SEEDS.map((seed) => {
    const history: StageHistoryEntry[] = seed.history.map((entry) => ({
      stage: entry.stage,
      result: entry.result,
      changed_at: isoAt(entry.day_offset, 14, 20),
      source: entry.source,
      source_label: entry.source.startsWith("recruitment_mail")
        ? "招聘邮件"
        : entry.source.startsWith("edge")
          ? "Edge 官网"
          : "手动记录",
    }));
    return {
      ...audit(seed.updated_day_offset - 14),
      id: seed.id,
      company_name: seed.company_name,
      job_title: seed.job_title,
      job_id: seed.job_id ?? null,
      record_url: seed.record_url ?? null,
      stage: seed.stage,
      idempotency_key: `idem-${seed.id}`,
      note: seed.note ?? null,
      stage_history: history,
      source_stage: seed.result ? String(seed.stage) : null,
      source_status: seed.result ?? null,
      source_status_synced_at: isoAt(seed.updated_day_offset, 7, 5),
      updated_at: isoAt(seed.updated_day_offset, 16, 40),
    };
  });
}

/**
 * 日程覆盖前端的三种分组：逾期（overdue）、即将到期（7 天内）、其他，
 * 以及三种 time_kind 与三种 status，还有「未定日期」和「来源邮件」两类特殊项。
 */
interface ScheduleSeed {
  id: string;
  title: string;
  event_type: string;
  company_name: string;
  job_title: string;
  application_stage: ApplicationStage;
  day_offset: number | null;
  event_time: string | null;
  time_kind: "appointment" | "deadline" | "unspecified";
  status: "pending" | "completed" | "ignored";
  application_id?: string | null;
  location_or_link?: string | null;
  note?: string | null;
  source?: string;
  source_ref?: string | null;
}

const SCHEDULE_SEEDS: ScheduleSeed[] = [
  {
    id: "sch-3001", title: "美团 · 前端笔试", event_type: "笔试", company_name: "美团",
    job_title: "前端开发工程师-到店事业群", application_stage: "written",
    day_offset: -2, event_time: "19:00", time_kind: "deadline", status: "pending",
    application_id: "app-2003", location_or_link: "https://zhaopin.meituan.com/exam/2003",
    note: "限时 90 分钟，逾期视为放弃。",
  },
  {
    id: "sch-3002", title: "米哈游 · 一面（技术面）", event_type: "面试", company_name: "米哈游",
    job_title: "游戏服务器开发工程师", application_stage: "interview1",
    day_offset: 0, event_time: "14:30", time_kind: "appointment", status: "pending",
    application_id: "app-2004", location_or_link: "https://meeting.example.test/mihoyo-1",
    note: "腾讯会议，提前 10 分钟入会。", source: "recruitment_mail_schedule", source_ref: "mail-4003",
  },
  {
    id: "sch-3003", title: "字节跳动 · 测评截止", event_type: "截止", company_name: "字节跳动",
    job_title: "后端开发工程师-基础架构", application_stage: "assessment",
    day_offset: 1, event_time: "23:59", time_kind: "deadline", status: "pending",
    application_id: "app-2002", location_or_link: null, note: "完成性格与能力测评。",
  },
  {
    id: "sch-3004", title: "金山办公 · 二面", event_type: "面试", company_name: "金山办公",
    job_title: "C++ 研发工程师（提前批）", application_stage: "interview2",
    day_offset: 3, event_time: "10:00", time_kind: "appointment", status: "pending",
    application_id: "app-2005", location_or_link: "线上会议链接稍后邮件发送",
    note: "重点准备内存管理与并发。",
  },
  {
    id: "sch-3005", title: "华为 · HR 面", event_type: "面试", company_name: "华为",
    job_title: "AI 平台开发工程师", application_stage: "hr",
    day_offset: 5, event_time: "16:00", time_kind: "appointment", status: "pending",
    application_id: "app-2006", location_or_link: null,
  },
  {
    id: "sch-3006", title: "商汤科技 · Offer 答复截止", event_type: "截止", company_name: "商汤科技",
    job_title: "深度学习推理优化工程师", application_stage: "offer",
    day_offset: 6, event_time: null, time_kind: "deadline", status: "pending",
    application_id: "app-2007", note: "需要在此之前完成对比决策。",
  },
  {
    id: "sch-3007", title: "阿里巴巴 · 提前批笔试", event_type: "笔试", company_name: "阿里巴巴",
    job_title: "数据研发工程师（提前批）", application_stage: "written",
    day_offset: 12, event_time: "18:30", time_kind: "appointment", status: "pending",
    application_id: "app-2011", location_or_link: "https://talent.alibaba.com/exam/2011",
  },
  {
    id: "sch-3008", title: "腾讯 · 提前批投递确认", event_type: "投递", company_name: "腾讯",
    job_title: "后台开发工程师（校招提前批）", application_stage: "applied",
    day_offset: -8, event_time: "11:00", time_kind: "appointment", status: "completed",
    application_id: "app-2001",
  },
  {
    id: "sch-3009", title: "拼多多 · 笔试", event_type: "笔试", company_name: "拼多多",
    job_title: "测试开发工程师", application_stage: "written",
    day_offset: -12, event_time: "20:00", time_kind: "appointment", status: "ignored",
    application_id: "app-2008", note: "该岗位已结束，日程标记为忽略。",
  },
  {
    id: "sch-3010", title: "蔚来 · 待确认面试", event_type: "面试", company_name: "蔚来",
    job_title: "车联网云平台开发工程师", application_stage: "interview1",
    day_offset: null, event_time: null, time_kind: "unspecified", status: "pending",
    application_id: "app-2010", note: "HR 说下周电话确认时间。",
  },
];

export function buildSchedule(): ScheduleEvent[] {
  return SCHEDULE_SEEDS.map((seed, index) => {
    const eventDate = seed.day_offset === null ? null : dateOffsetKey(seed.day_offset);
    return {
      ...audit(seed.day_offset ?? -1),
      id: seed.id,
      title: seed.title,
      event_date: eventDate,
      status: seed.status,
      time_kind: seed.time_kind,
      event_time: seed.event_time,
      event_type: seed.event_type,
      company_name: seed.company_name,
      job_title: seed.job_title,
      application_stage: seed.application_stage,
      starts_at: eventDate ? `${eventDate}T${seed.event_time ?? "09:00"}:00+08:00` : null,
      ends_at: null,
      application_id: seed.application_id ?? null,
      location_or_link: seed.location_or_link ?? null,
      note: seed.note ?? null,
      source: seed.source ?? "local_ui",
      source_ref: seed.source_ref ?? null,
      updated_at: isoAt(-1 + (index % 3), 9, 20),
    };
  });
}
