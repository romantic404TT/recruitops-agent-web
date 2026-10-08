import type { ReactNode } from "react";
import { scoreBadgeModel } from "@/lib/format";

/** 上游 loading()/empty()/errorState() 三个骨架态（app.js:300 附近）。 */

export function LoadingRows({ rows = 3, short = false }: { rows?: number; short?: boolean }) {
  return (
    <div
      className={`loading-rows${short ? " loading-rows--short" : ""}`}
      aria-label="加载中"
    >
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty-state empty-state--inline">
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

export function ErrorState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="error-state">
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

/**
 * 容器状态壳：原项目用 `data-state` 属性驱动 CSS，
 * 这里保留同名属性，样式在 index.css 里按 [data-state] 命中。
 */
export function StateRegion({
  state,
  className,
  children,
  ariaLabel,
  live,
}: {
  state: "loading" | "ready" | "empty" | "error" | "unknown";
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  live?: boolean;
}) {
  return (
    <div
      className={className}
      data-state={state}
      aria-label={ariaLabel}
      aria-live={live ? "polite" : undefined}
    >
      {children}
    </div>
  );
}

export function ScoreBadge({
  score,
  status = null,
  large = false,
}: {
  score?: number | null;
  status?: string | null;
  large?: boolean;
}) {
  const model = scoreBadgeModel(score, status);
  return (
    <span
      className={`score-badge score-badge--${model.tone}${large ? " score-badge--large" : ""}`}
    >
      {model.label}
    </span>
  );
}

/** 上游表格空态：一个 colspan 撑满的单元格。 */
export function TableEmptyRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td className="table-empty" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}

export function TableLoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <LoadingRows rows={2} />
      </td>
    </tr>
  );
}
