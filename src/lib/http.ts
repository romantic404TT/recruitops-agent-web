/**
 * 复刻上游 app.js:200 的 `api()` helper —— 语义严格保持一致：
 * 1) 默认带 `Accept: application/json`；
 * 2) 响应体解析失败不抛，降级成 null；
 * 3) 非 2xx 时抛 `Error(payload.detail)`，没有 detail 才用中文兜底文案。
 * 上层大量 `catch (error) => showToast(error.message)` 依赖这个不变式。
 */

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/** 上游 authHeaders(reason) 实际只加一个同源标记头；reason 仅用于埋点/可读性。 */
export function authHeaders(reason?: string, extra: HeadersInit = {}): Record<string, string> {
  void reason;
  return { ...(extra as Record<string, string>), "X-RecruitOps-Local-UI": "1" };
}

const DEFAULT_TIMEOUT_MS = 30_000;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  /** 上游对 resume/parse 用 60s，其余 30s。传 false 可关掉超时。 */
  timeoutMs?: number | false;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, signal, ...rest } = options;
  const effectiveSignal =
    signal ?? (timeoutMs === false ? undefined : AbortSignal.timeout(timeoutMs));

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: { Accept: "application/json", ...(headers as Record<string, string>) },
      signal: effectiveSignal,
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiError("请求超时", 0, null);
    }
    throw new ApiError("无法连接本机服务", 0, null);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && typeof (payload as { detail?: unknown }).detail === "string"
        ? (payload as { detail: string }).detail
        : `请求失败（${response.status}）`;
    throw new ApiError(detail, response.status, payload);
  }

  return payload as T;
}

/**
 * 配置接口在上游是 POST /api/local-ui/configuration/{path}，
 * 且带 same-origin 凭据（configuration.js:26）。
 */
export async function postConfig<T = unknown>(
  path: string,
  payload: unknown = {},
  timeoutMs = 30_000,
): Promise<T> {
  return api<T>(`/api/local-ui/configuration/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: authHeaders("配置", { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    timeoutMs,
  });
}
