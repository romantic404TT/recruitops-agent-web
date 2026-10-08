import { HttpResponse } from "msw";

/**
 * 上游对本机写入接口有两道闸：
 * 1) 必须带 `X-RecruitOps-Local-UI: 1`（同源 UI 标记），否则 403；
 * 2) 写开关 write_enabled，关掉时一律 403「Writes are disabled」。
 * mock 层保留同样的拒绝路径，避免前端误以为任何请求都会成功。
 */
export const LOCAL_UI_HEADER = "X-RecruitOps-Local-UI";

export function requireLocalUi(request: Request): HttpResponse | null {
  if (request.headers.get(LOCAL_UI_HEADER) !== "1") {
    return HttpResponse.json(
      { detail: "Local same-origin UI request required" },
      { status: 403 },
    );
  }
  return null;
}

/** 乐观并发：expected_updated_at 与库里不一致时 409，和上游一样。 */
export function conflictIfStale(
  currentUpdatedAt: string,
  expected: unknown,
): HttpResponse | null {
  if (!expected) {
    return HttpResponse.json({ detail: "expected_updated_at is required" }, { status: 422 });
  }
  if (String(expected) !== String(currentUpdatedAt)) {
    return HttpResponse.json(
      { detail: "Record changed; refresh and retry" },
      { status: 409 },
    );
  }
  return null;
}

export function notFound(detail = "Not found"): HttpResponse {
  return HttpResponse.json({ detail }, { status: 404 });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export const searchParamsOf = (request: Request) => new URL(request.url).searchParams;

export const intParam = (params: URLSearchParams, key: string, fallback: number): number => {
  const raw = params.get(key);
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
