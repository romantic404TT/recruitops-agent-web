import { useToastStore } from "@/stores/toast";

/**
 * 上游是 `#toast-region` + 命令式 appendChild。
 * 复刻版把它做成挂在 AppShell 外的单例浮层，`aria-live` 语义保持一致。
 */
export function ToastViewport() {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div
          key={item.id}
          className={`toast toast--${item.kind}`}
          role="status"
          onClick={() => dismiss(item.id)}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
