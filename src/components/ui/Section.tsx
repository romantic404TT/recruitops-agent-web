import type { ReactNode } from "react";

/** 上游 .section-heading 的三种形态：完整版、compact 版、带右侧动作。 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
  titleId,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  titleId?: string;
}) {
  const HeadingTag = compact ? "h3" : "h2";
  return (
    <div className={`section-heading${compact ? " section-heading--compact" : ""}`}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <HeadingTag id={titleId}>{title}</HeadingTag>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}

export function MutedLabel({ children }: { children: ReactNode }) {
  return <span className="muted-label">{children}</span>;
}

export function StatusDot({ tone = "ok" }: { tone?: "ok" | "warn" | "error" | "muted" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

export function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "muted" | "good" | "warn" | "error" | "success";
}) {
  return <span className={`table-tag${tone ? ` table-tag--${tone}` : ""}`}>{children}</span>;
}

/**
 * 指标卡（.metric-item）。上游有两种装饰：左侧色条（首页）与图标（岗位页），
 * 这里用一个组件覆盖，bar / icon 二选一。
 */
export function MetricItem({
  label,
  value,
  detail,
  bar,
  icon,
  iconTone,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  bar?: "teal" | "blue" | "amber" | "rose";
  icon?: ReactNode;
  /** 上游类名为 metric-icon--jobs / --companies / --match / --pending。 */
  iconTone?: "jobs" | "companies" | "match" | "pending";
}) {
  return (
    <article className="metric-item">
      {bar ? (
        <div className="metric-label">
          <span className={`metric-bar metric-bar--${bar}`} aria-hidden="true" />
          {label}
        </div>
      ) : null}
      {icon ? (
        <span
          className={`metric-icon${iconTone ? ` metric-icon--${iconTone}` : ""}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      {!bar && !icon ? <div className="metric-label">{label}</div> : null}
      <strong className="metric-value">{value}</strong>
      {detail ? <span className="metric-detail">{detail}</span> : null}
    </article>
  );
}

/** .company-metrics / .automation-summary 那种「标签 + 数字」的两行小组。 */
export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** 上游 .workspace-section 容器。 */
export function WorkspaceSection({
  children,
  className,
  ariaLabelledby,
  hidden,
}: {
  children: ReactNode;
  className?: string;
  ariaLabelledby?: string;
  hidden?: boolean;
}) {
  return (
    <section
      className={`workspace-section${className ? ` ${className}` : ""}`}
      aria-labelledby={ariaLabelledby}
      hidden={hidden}
    >
      {children}
    </section>
  );
}
