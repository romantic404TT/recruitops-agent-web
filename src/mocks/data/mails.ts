import { isoAt } from "./_clock";
import type { RecruitmentMail } from "@/types/mail";

/**
 * 招聘邮件 fixture：覆盖 MAIL_CATEGORY_LABELS 的全部 7 类，
 * 以及 MAIL_PROCESSING_STATUS_LABELS 里的每种处理态，
 * 让「处理：」「关联：」两组标签的所有色调都能在界面上出现。
 */
interface MailSeed extends Omit<RecruitmentMail, "received_at"> {
  day_offset: number;
  hour?: number;
}

const MAIL_SEEDS: MailSeed[] = [
  {
    id: "mail-4001", subject: "【腾讯】2027 校园招聘提前批投递确认", sender: "Tencent.Campus@tencent.com",
    category: "application_confirmation", confidence: 0.96, processing_status: "processed_unchanged",
    application_id: "app-2001", company_name: "腾讯", job_title: "后台开发工程师（校招提前批）",
    requires_confirmation: false, day_offset: -9, hour: 10,
    body_text:
      "同学你好：\n我们已收到你投递的「后台开发工程师（校招提前批）」岗位，当前状态：简历评估中。\n请留意后续笔试与面试通知。\n—— 腾讯校招团队",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<tencent-2001@tencent.com>",
  },
  {
    id: "mail-4002", subject: "【美团】2027 校招笔试通知（前端方向）", sender: "campus@meituan.com",
    category: "written_test", confidence: 0.93, processing_status: "processed_updated",
    application_id: "app-2003", company_name: "美团", job_title: "前端开发工程师-到店事业群",
    requires_confirmation: false, day_offset: -5, hour: 15,
    body_text:
      "你的笔试安排如下：\n岗位：前端开发工程师\n开始时间：报名后系统分配，请在 48 小时内完成\n考试链接：https://zhaopin.meituan.com/exam/2003\n逾期未作答视为放弃。",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<meituan-2003@meituan.com>",
    company_candidates: [{ value: "美团", confidence: 0.99 }],
    job_candidates: [{ value: "前端开发工程师-到店事业群", confidence: 0.94 }],
  },
  {
    id: "mail-4003", subject: "米哈游游戏研发 · 一面邀约（请确认时间）", sender: "hr@mihoyo.com",
    category: "interview", confidence: 0.88, processing_status: "needs_confirmation",
    application_id: "app-2004", company_name: "米哈游", job_title: "游戏服务器开发工程师",
    requires_confirmation: true, day_offset: -2, hour: 18,
    body_text:
      "同学你好，恭喜通过简历筛选。\n面试官希望安排在今天 14:30 之后的腾讯会议进行一面，时长约 60 分钟。\n如时间不便，请回复两个可行时段。\n会议链接：https://meeting.example.test/mihoyo-1",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<mihoyo-interview@mihoyo.com>",
  },
  {
    id: "mail-4004", subject: "【字节跳动】27 届校招综合素质测评", sender: "campus@bytedance.com",
    category: "assessment", confidence: 0.91, processing_status: "linked",
    application_id: "app-2002", company_name: "字节跳动", job_title: "后端开发工程师-基础架构",
    requires_confirmation: false, day_offset: -3, hour: 9,
    body_text:
      "请在 48 小时内完成在线测评，测评结果将作为后续流程参考。\n入口：https://jobs.bytedance.com/campus/assessment",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<bytedance-assess@bytedance.com>",
  },
  {
    id: "mail-4005", subject: "商汤科技 2027 校招意向书发放通知", sender: "campus@sensetime.com",
    category: "offer", confidence: 0.97, processing_status: "processed_updated",
    application_id: "app-2007", company_name: "商汤科技", job_title: "深度学习推理优化工程师",
    requires_confirmation: false, day_offset: -6, hour: 11,
    body_text:
      "祝贺你通过全部面试环节，我们决定向你发出 2027 校招意向书。\n请在 6 天内在系统内完成答复。\n岗位：深度学习推理优化工程师 / 工作地点：上海。",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<sensetime-offer@sensetime.com>",
  },
  {
    id: "mail-4006", subject: "感谢你的关注 —— 拼多多 2027 校招结果通知", sender: "campus@pdd.com",
    category: "rejection", confidence: 0.89, processing_status: "processed_unchanged",
    application_id: "app-2008", company_name: "拼多多", job_title: "测试开发工程师",
    requires_confirmation: false, day_offset: -7, hour: 17,
    body_text: "经过综合评估，你的本次应聘暂未通过。感谢你选择拼多多。",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<pdd-reject@pdd.com>",
  },
  {
    id: "mail-4007", subject: "金山办公 · 二面时间确认", sender: "campus@wps.cn",
    category: "interview", confidence: 0.84, processing_status: "pending_association",
    application_id: null, company_name: null, job_title: null,
    requires_confirmation: true, day_offset: -1, hour: 20,
    body_text:
      "您好，我们计划安排第三轮技术面试中的第二轮，暂定下周三上午 10:00。\n请确认是否可行，我们将随后发送会议链接。",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<wps-int2@wps.cn>",
  },
  {
    id: "mail-4008", subject: "【重要】某招聘平台年度会员续费提醒", sender: "noreply@vip-jobboard.test",
    category: "other", confidence: 0.21, processing_status: "irrelevant",
    application_id: null, company_name: null, job_title: null,
    requires_confirmation: false, day_offset: -4, hour: 8,
    body_text: "您的招聘平台增值服务即将到期，续费可享受更多曝光权益。",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<renew@vip-jobboard.test>",
  },
  {
    id: "mail-4009", subject: "阿里巴巴 27 届提前批笔试安排", sender: "campus@alibaba-inc.com",
    category: "written_test", confidence: 0.9, processing_status: "pending",
    application_id: "app-2011", company_name: "阿里巴巴", job_title: "数据研发工程师（提前批）",
    requires_confirmation: true, day_offset: 0, hour: 8,
    body_text:
      "你的笔试已安排，请在 12 天后的 18:30 准时进入考试链接。\n岗位：数据研发工程师（提前批）\n时长：120 分钟。",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<alibaba-exam@alibaba-inc.com>",
  },
  {
    id: "mail-4010", subject: "华为 2027 校招 AI 平台岗位流程更新", sender: "career@huawei.com",
    category: "interview", confidence: null, processing_status: "failed",
    application_id: "app-2006", company_name: "华为", job_title: "AI 平台开发工程师",
    requires_confirmation: true, day_offset: 0, hour: 9,
    body_text: "你的流程已进入 HR 面环节，具体时间将由联系人与你电话约定。",
    recipients: ["me@example.test"], mailbox: "INBOX", message_id: "<huawei-hr@huawei.com>",
  },
];

export function buildMails(): RecruitmentMail[] {
  return MAIL_SEEDS.map(({ day_offset, hour, ...rest }) => ({
    ...rest,
    received_at: isoAt(day_offset, hour ?? 10, 12),
    created_at: isoAt(day_offset, hour ?? 10, 20),
    updated_at: isoAt(day_offset, hour ?? 10, 20),
    content_digest: `sha256:${rest.id}`,
    raw_metadata: {},
  })) as unknown as RecruitmentMail[];
}

export const MAIL_TOTAL = MAIL_SEEDS.length;
