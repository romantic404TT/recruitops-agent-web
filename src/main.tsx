import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";

/**
 * 生产构建里 `import.meta.env.DEV` 是编译期常量 false，
 * 整个 `@/mocks/browser` 分支连同 msw 依赖会被摇树掉，不进 bundle。
 */
async function bootstrap() {
  if (import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS === "1") {
    const { startMockWorker } = await import("@/mocks/browser");
    await startMockWorker();
  }
  const container = document.getElementById("root");
  if (!container) throw new Error("找不到 #root 挂载点");
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap();
