import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * 只在开发/预览里启用；生产构建通过 `import.meta.env.DEV` 与
 * 构建期常量把整个 msw 依赖从 bundle 里摇树出去（见 main.tsx）。
 */
export async function startMockWorker(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    // 上游没有的接口一律透传，让 Vite HMR / 静态资源不受影响。
    onUnhandledRequest: "bypass",
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
