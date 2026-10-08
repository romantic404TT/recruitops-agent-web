import type { ConfigurationReadResponse } from "@/types/configuration";

/** 上游 INDUSTRY_GROUP_OPTIONS（packages/config/offerbiu 常量）逐条照搬。 */
export const INDUSTRY_GROUPS: ConfigurationReadResponse["options"]["industry_groups"] = [
  { code: "internet-tech", label: "互联网/软件/AI", default: true },
  { code: "semiconductor-hardware", label: "半导体/电子硬件", default: false },
  { code: "finance", label: "金融/银行/证券/保险", default: false },
  { code: "professional-services", label: "咨询/法律/专业服务", default: false },
  { code: "manufacturing-equipment", label: "制造/装备/工业自动化", default: true },
  { code: "auto-transport-equipment", label: "汽车/新能源车/交通设备", default: false },
  { code: "energy-chemical-environment", label: "能源/电力/化工/环保", default: false },
  { code: "biotech-healthcare", label: "生物医药/医疗健康", default: false },
  { code: "consumer-retail", label: "消费/零售/电商/快消", default: false },
  { code: "construction-real-estate", label: "建筑地产/市政工程", default: false },
  { code: "media-education-culture", label: "传媒/文娱/教育", default: false },
  { code: "public-research-nonprofit", label: "政府/事业单位/科研/公益", default: false },
  { code: "logistics-supply-chain", label: "物流/供应链/交通运输", default: false },
  { code: "other", label: "其他/待归类", default: false },
];

/** 上游 MAIL_PROVIDER_OPTIONS（apps/api/configuration.py:41）。 */
export const MAIL_PROVIDERS: ConfigurationReadResponse["options"]["mail_providers"] = [
  { id: "163", label: "163 邮箱", host: "imap.163.com", port: 993 },
  { id: "126", label: "126 邮箱", host: "imap.126.com", port: 993 },
  { id: "qq", label: "QQ 邮箱", host: "imap.qq.com", port: 993 },
  { id: "gmail", label: "Gmail", host: "imap.gmail.com", port: 993 },
  { id: "outlook", label: "Outlook / Microsoft 365", host: "outlook.office365.com", port: 993 },
  { id: "custom", label: "企业邮箱 / 自定义 IMAP", host: "", port: 993 },
];

/**
 * 初值刻意做成「模型未配置、关键词已填、邮箱未配」，
 * 这样首屏能同时演示：onboarding 未就绪提示条、助理不可用文案、
 * 以及保存后才消失的那类状态。
 */
export function initialConfiguration(): ConfigurationReadResponse {
  return {
    settings: {
      degree: "本科",
      llm_enabled: true,
      codex_runtime_enabled: true,
      vision_enabled: false,
      mail_imap_host: "",
      mail_imap_username: "",
      mail_imap_port: 993,
      mail_imap_mailbox: "INBOX",
    },
    secrets: { mail_imap_password: false },
    profile: {
      degree: "本科",
      job_type: "全职",
      direction: "服务端开发",
      skills: {
        verified: ["Go", "C++", "MySQL", "Redis"],
        supporting: ["Docker", "Kubernetes", "Rust"],
        unverified: ["Flink"],
      },
      matching: {
        title_keywords: ["后端", "服务端", "基础架构", "平台"],
        excluded_title_keywords: ["实习", "日常实习"],
        direction_policy: "优先服务端，允许基础架构",
        primary_directions: ["服务端开发", "基础架构"],
        secondary_directions: ["数据研发"],
        project_evidence: ["独立实现限流与熔断的服务网关"],
        supporting_skills: ["Linux 系统编程"],
        learning_targets: ["大规模容量规划"],
        unverified_skills: ["Flink 实时链路"],
      },
      scope: { industry_groups: ["internet-tech", "manufacturing-equipment"] },
    },
    model_connections: [
      {
        id: "conn-primary",
        name: "DeepSeek（主连接）",
        provider: "deepseek",
        api_style: "anthropic",
        base_url: "https://api.deepseek.com",
        model: "deepseek-chat",
        key_configured: false,
      },
      {
        id: "conn-backup",
        name: "OpenAI 兼容网关",
        provider: "openai-compatible",
        api_style: "openai",
        base_url: "",
        model: "",
        key_configured: false,
      },
    ],
    active_model_connection_id: "conn-primary",
    configured_capabilities: {
      llm_enabled: true,
      codex_runtime_enabled: true,
      vision_enabled: false,
    },
    options: { industry_groups: INDUSTRY_GROUPS, mail_providers: MAIL_PROVIDERS },
    onboarding: {
      ready: false,
      messages: {
        model_connection: "尚未配置可用的模型连接：请填写服务地址、模型名称与 API 密钥。",
        vision_optional: "浏览器截图识别属于高级能力，可以稍后再开启。",
      },
    },
    module_readiness: {
      assistant: { status: "missing_model" },
      job_scoring: { ready: false },
      scheduled_tasks: { ready: true },
    },
    bootstrap: { companies_created: false, profile_created: false },
    restart_required: true,
  };
}
