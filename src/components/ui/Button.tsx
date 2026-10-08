import type { ButtonHTMLAttributes, ReactNode } from "react";
import { UiIcon, type UiIconName } from "./UiIcon";

type Variant = "primary" | "secondary" | "ghost" | "text";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "button button--primary",
  secondary: "button button--secondary",
  ghost: "button button--ghost",
  text: "text-button",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  icon?: UiIconName;
  iconRight?: UiIconName;
  children?: ReactNode;
}

/** 上游按钮类名约定：`button button--primary|secondary|ghost`，小尺寸再加 `button--small`。 */
export function Button({
  variant = "secondary",
  small = false,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    small ? "button--small" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={rest.type ?? "button"} className={classes} {...rest}>
      {icon ? <UiIcon name={icon} /> : null}
      {children}
      {iconRight ? <UiIcon name={iconRight} /> : null}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍名称，上游总是同时给 title + aria-label。 */
  label: string;
  icon: UiIconName;
  small?: boolean;
  title?: string;
}

export function IconButton({
  label,
  icon,
  small = false,
  title,
  className,
  ...rest
}: IconButtonProps) {
  const classes = [
    "icon-button",
    small ? "icon-button--small" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type={rest.type ?? "button"}
      className={classes}
      title={title ?? label}
      aria-label={label}
      {...rest}
    >
      <UiIcon name={icon} />
    </button>
  );
}

/** 外链按钮：上游一律带 target=_blank + rel=noreferrer。 */
export function ExternalButton({
  href,
  label,
  small = true,
  title,
  ariaLabel,
}: {
  href: string;
  label?: string;
  small?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <a
      className={`icon-button${small ? " icon-button--small" : ""}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title ?? label ?? "打开链接"}
      aria-label={ariaLabel ?? title ?? label ?? "打开链接"}
    >
      <UiIcon name="external" />
      {label ? <span className="ml-1">{label}</span> : null}
    </a>
  );
}

/** 主行动链接（如「打开招聘页」）用的是 a.button。 */
export function LinkButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <a className={VARIANT_CLASS[variant]} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
