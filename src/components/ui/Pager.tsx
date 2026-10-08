import type { ReactNode } from "react";
import { Button } from "./Button";

/** 上游 .pager：上一页 / 第 N / M 页 · 共 X 条 / 下一页。 */
export function Pager({
  page,
  pages,
  total,
  unit = "条",
  onPrev,
  onNext,
}: {
  page: number;
  pages: number;
  total: number;
  unit?: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="pager" aria-label="分页">
      <Button variant="ghost" disabled={page <= 1} onClick={onPrev}>
        上一页
      </Button>
      <span>
        第 {page} / {pages} 页 · 共 {total} {unit}
      </span>
      <Button variant="ghost" disabled={page >= pages} onClick={onNext}>
        下一页
      </Button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** 上游 .segmented-control：作业范围（全部/今日）与日程视图（待办/月历）都用它。 */
export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
  asTabs = false,
}: {
  ariaLabel: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  asTabs?: boolean;
}) {
  return (
    <div
      className={`segmented-control${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          className={`segment-button${value === option.value ? " is-active" : ""}`}
          type="button"
          role={asTabs ? "tab" : undefined}
          aria-selected={asTabs ? value === option.value : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
