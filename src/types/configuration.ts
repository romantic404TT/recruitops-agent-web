/**
 * 个人配置（`/api/local-ui/configuration/*`，全部 POST）。
 * 上游 `apps/api/configuration.py:363` 的 `/read` 返回结构。
 */

export type ModelProvider = "deepseek" | "openai-compatible";
export type ApiStyle = "anthropic" | "openai";

export interface ModelConnection {
  id: string;
  name: string;
  provider: ModelProvider;
  api_style: ApiStyle;
  base_url: string;
  model: string;
  /** 读取时不回传明文，只回传 key_configured。 */
  api_key?: string;
  key_configured?: boolean;
}

/** 前端 MODEL_PRESETS（configuration.js:15）——决定 api_style 与默认地址。 */
export const MODEL_PRESETS: Record<
  ModelProvider,
  { label: string; api_style: ApiStyle; base_url: string; model: string }
> = {
  deepseek: {
    label: "DeepSeek",
    api_style: "anthropic",
    base_url: "https://api.deepseek.com",
    model: "deepseek-flash",
  },
  "openai-compatible": {
    label: "OpenAI 兼容接口",
    api_style: "openai",
    base_url: "",
    model: "",
  },
};

export interface ConfigurationSettings {
  degree?: string;
  llm_enabled?: boolean;
  codex_runtime_enabled?: boolean;
  vision_enabled?: boolean;
  mail_imap_host?: string;
  mail_imap_username?: string;
  mail_imap_port?: number | string;
  mail_imap_mailbox?: string;
  [key: string]: unknown;
}

/** secrets 只回传布尔值，绝不明文回传密钥。 */
export interface ConfigurationSecrets {
  mail_imap_password?: boolean;
  [key: string]: boolean | undefined;
}

export interface CandidateProfile {
  degree?: string;
  job_type?: string;
  direction?: string;
  skills?: {
    verified?: string[];
    supporting?: string[];
    unverified?: string[];
    [key: string]: unknown;
  };
  matching?: {
    title_keywords?: string[];
    excluded_title_keywords?: string[];
    direction_policy?: string;
    primary_directions?: string[];
    secondary_directions?: string[];
    project_evidence?: string[];
    supporting_skills?: string[];
    learning_targets?: string[];
    unverified_skills?: string[];
    [key: string]: unknown;
  };
  scope?: {
    industry_groups?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface IndustryGroupOption {
  code: string;
  label: string;
  default: boolean;
}

export interface MailProviderOption {
  id: string;
  label: string;
  host: string;
  port: number;
}

/**
 * module_readiness 的已知诊断码。
 * 前端把 assistant.status 映射成中文标签（configuration.js:244）。
 */
export type AssistantReadinessStatus =
  | "missing_model"
  | "disabled"
  | "restart_required"
  | "configured"
  | "unknown";

export const ASSISTANT_STATUS_LABELS: Record<string, string> = {
  missing_model: "待配置模型",
  disabled: "已主动关闭",
  restart_required: "待重启",
  configured: "模型已配置",
};

export interface ModuleReadiness {
  assistant?: { status?: AssistantReadinessStatus | string; [key: string]: unknown };
  job_scoring?: { ready?: boolean; [key: string]: unknown };
  scheduled_tasks?: { ready?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

export interface OnboardingReadiness {
  ready?: boolean;
  /** value 为待办说明文案，前端去重后渲染成列表。 */
  messages?: Record<string, string>;
  missing?: string[];
  [key: string]: unknown;
}

export interface ConfigurationReadResponse {
  settings: ConfigurationSettings;
  secrets: ConfigurationSecrets;
  profile: CandidateProfile;
  model_connections: ModelConnection[];
  active_model_connection_id: string;
  configured_capabilities: Record<string, boolean>;
  options: {
    industry_groups: IndustryGroupOption[];
    mail_providers: MailProviderOption[];
  };
  onboarding?: OnboardingReadiness | null;
  module_readiness?: ModuleReadiness;
  bootstrap?: { companies_created?: boolean; profile_created?: boolean };
  restart_required?: boolean;
}

export interface ConfigurationSaveBody {
  settings?: Record<string, unknown>;
  profile?: CandidateProfile | null;
  model_connections?: ModelConnection[];
  active_model_connection_id?: string | null;
  complete_onboarding?: boolean;
}

export interface ConfigurationSaveResponse {
  message: string;
  restart_required?: boolean;
  changed?: string[];
  [key: string]: unknown;
}

export interface ModelTestBody {
  connection_id?: string;
  [key: string]: unknown;
}

export interface ModelTestResponse {
  ok?: boolean;
  status?: string;
  message?: string;
  detail?: string;
  [key: string]: unknown;
}

export interface MailTestResponse {
  ok?: boolean;
  status?: string;
  message?: string;
  detail?: string;
  folders?: string[];
  [key: string]: unknown;
}

export interface ResumeParseResponse {
  profile?: CandidateProfile;
  skills?: string[];
  stack?: string[];
  projects?: string[];
  title_keywords?: string[];
  degree?: string;
  evidence?: string;
  warnings?: string[];
  [key: string]: unknown;
}

export interface ApplicationImportResponse {
  inserted?: number;
  skipped?: number;
  message?: string;
  errors?: string[];
  [key: string]: unknown;
}

export interface LatestCrawlResponse {
  found?: boolean;
  report?: Record<string, unknown> | null;
  [key: string]: unknown;
}
