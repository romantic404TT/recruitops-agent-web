import { useEffect, useRef, type ReactNode } from "react";

/**
 * 上游用原生 `<dialog>` + showModal()（index.html:738-810，共 4 个弹层）。
 * 复刻版保留原生 dialog：ESC 关闭、::backdrop、焦点陷阱都是浏览器自带的，
 * 不需要自研，也避免和原项目行为产生差异。
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** 复用上游 .job-detail-dialog 家族类名（其它三个弹层在它上面叠类）。 */
  className?: string;
  labelledby?: string;
  kicker?: ReactNode;
  title: ReactNode;
  closeLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({
  open,
  onClose,
  className = "",
  labelledby,
  kicker,
  title,
  closeLabel = "关闭",
  children,
  footer,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      if (typeof node.showModal === "function") node.showModal();
      else node.setAttribute("open", "");
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`job-detail-dialog${className ? ` ${className}` : ""}`}
      aria-labelledby={labelledby}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 点在 backdrop 上（dialog 自身区域）时关闭，与常见行为一致。
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="job-detail-shell">
        <header className="job-detail-header">
          <div>
            {kicker ? <p className="eyebrow">{kicker}</p> : null}
            <h2 id={labelledby}>{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={closeLabel}
            title="关闭"
            onClick={onClose}
          >
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        {children}
        {footer ? (
          <footer className="automation-detail-actions">{footer}</footer>
        ) : null}
      </div>
    </dialog>
  );
}

/** 上游 .job-detail-actions：弹层底部按钮排。 */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="job-detail-actions">{children}</div>;
}
