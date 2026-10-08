import { create } from "zustand";
import { postConfig } from "@/lib/http";
import type {
  ApplicationImportResponse,
  ConfigurationReadResponse,
  ConfigurationSaveBody,
  ConfigurationSaveResponse,
  LatestCrawlResponse,
  MailTestResponse,
  ModelConnection,
  ModelTestResponse,
  ResumeParseResponse,
} from "@/types/configuration";

/**
 * 个人配置。上游 configuration.js 是一个 IIFE + 模块级变量
 * （original / resumeDraft / workingProfile / modelConnections / activeModelConnectionId），
 * 这里一一对应成 store 字段，保持「读到的原值 / 正在编辑的草稿」分离。
 */
interface ConfigurationState {
  original: ConfigurationReadResponse | null;
  workingProfile: ConfigurationReadResponse["profile"] | null;
  modelConnections: ModelConnection[];
  activeModelConnectionId: string;
  resumeDraft: ResumeParseResponse | null;
  parsingResume: boolean;
  reading: boolean;
  message: string;
  messageFailed: boolean;
  inlineMessages: Record<string, { text: string; failed: boolean }>;
  lastCrawlReport: unknown | null;

  read: () => Promise<boolean>;
  saveModelConnections: (settings?: Record<string, unknown>) => Promise<void>;
  saveConfiguration: (body: ConfigurationSaveBody) => Promise<ConfigurationSaveResponse>;
  testModel: (body: Record<string, unknown>) => Promise<ModelTestResponse>;
  testMail: (body: Record<string, unknown>) => Promise<MailTestResponse>;
  saveResume: (body: Record<string, unknown>) => Promise<unknown>;
  parseResume: (payload: { filename: string; content: string }) => Promise<ResumeParseResponse>;
  importApplications: (payload: {
    filename: string;
    format: "csv" | "json";
    content: string;
  }) => Promise<ApplicationImportResponse>;
  fetchLatestCrawl: () => Promise<LatestCrawlResponse>;
  setInlineMessage: (id: string, text: string, failed?: boolean) => void;
}

const ok = <T,>(value: T) => value;

export const useConfigurationStore = create<ConfigurationState>((set, get) => ({
  original: null,
  workingProfile: null,
  modelConnections: [],
  activeModelConnectionId: "",
  resumeDraft: null,
  parsingResume: false,
  reading: false,
  message: "",
  messageFailed: false,
  inlineMessages: {},
  lastCrawlReport: null,

  read: async () => {
    if (get().reading || get().parsingResume) return false;
    set({ reading: true, resumeDraft: null });
    try {
      const payload = await postConfig<ConfigurationReadResponse>("read");
      // 上游对旧后端有硬校验：缺任一能力就整体判失败，不部分渲染。
      if (
        !Array.isArray(payload.model_connections) ||
        !payload.options?.industry_groups ||
        !payload.options?.mail_providers
      ) {
        set({ original: null, reading: false });
        throw new Error(
          "配置 API 尚未支持多模型连接、行业和邮箱选项，请先更新后端。未修改现有配置。",
        );
      }
      set({
        original: payload,
        workingProfile: structuredClone(payload.profile),
        modelConnections: payload.model_connections.map((item) => ({ ...item })),
        activeModelConnectionId: payload.active_model_connection_id,
        reading: false,
        message: "",
        messageFailed: false,
      });
      return true;
    } catch (error) {
      set({
        original: null,
        reading: false,
        message: `读取失败：${(error as Error).message}`,
        messageFailed: true,
      });
      return false;
    }
  },

  saveModelConnections: async (settings = {}) => {
    const { modelConnections, activeModelConnectionId, original } = get();
    const active = modelConnections.find(
      (item) => item.id === activeModelConnectionId,
    );
    const previouslyConfigured = original?.model_connections?.find(
      (item) => item.id === activeModelConnectionId,
    )?.key_configured;
    if (!active?.base_url || !active?.model || !(active.api_key || previouslyConfigured)) {
      get().setInlineMessage(
        "model-connection-message",
        "请填写主模型的服务地址、模型名称和 API 密钥。",
        true,
      );
      return;
    }
    get().setInlineMessage("model-connection-message", "正在保存…");
    try {
      const result = await get().saveConfiguration({
        settings,
        model_connections: modelConnections,
        active_model_connection_id: activeModelConnectionId,
      });
      await get().read();
      get().setInlineMessage("model-connection-message", result.message);
    } catch (error) {
      get().setInlineMessage(
        "model-connection-message",
        `保存失败：${(error as Error).message}`,
        true,
      );
    }
  },

  saveConfiguration: (body) =>
    postConfig<ConfigurationSaveResponse>("save", body).then(ok),

  testModel: (body) => postConfig<ModelTestResponse>("model/test", body, 60_000).then(ok),

  testMail: (body) => postConfig<MailTestResponse>("mail/test", body).then(ok),

  saveResume: (body) => postConfig("resume", body).then(ok),

  /** 简历解析上游给 60s 超时（configuration.js:29）。 */
  parseResume: (payload) =>
    postConfig<ResumeParseResponse>("resume/parse", payload, 60_000).then(ok),

  importApplications: (payload) =>
    postConfig<ApplicationImportResponse>("applications/import", payload).then(ok),

  fetchLatestCrawl: () => postConfig<LatestCrawlResponse>("latest-crawl").then(ok),

  setInlineMessage: (id, textValue, failed = false) =>
    set((state) => ({
      inlineMessages: {
        ...state.inlineMessages,
        [id]: { text: textValue, failed },
      },
    })),
}));

/** 上游 degreeOption：从任意学历字符串里归一到 博士/硕士/本科。 */
export function degreeOption(value: unknown): "博士" | "硕士" | "本科" | "" {
  const textValue = String(value ?? "");
  if (textValue.includes("博")) return "博士";
  if (textValue.includes("硕") || textValue.includes("研究生")) return "硕士";
  return textValue.includes("本") ? "本科" : "";
}

/** 上游 split()：按行切、去空白、丢空行。多行 textarea 全用它。 */
export const splitLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
