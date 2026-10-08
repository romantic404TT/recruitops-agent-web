import { IconButton } from "@/components/ui/Button";
import { useSystemStore } from "@/stores/system";
import { VIEW_TITLES } from "@/lib/labels";

export function Topbar({
  view,
  onToggleMobile,
  mobileOpen,
}: {
  view: string;
  onToggleMobile: () => void;
  mobileOpen: boolean;
}) {
  const todayLabel = useSystemStore((state) => state.todayLabel);
  const status = useSystemStore((state) => state.status);
  const statusText = useSystemStore((state) => state.statusText);
  const refreshAll = useSystemStore((state) => state.refreshAll);
  const bootstrapping = useSystemStore((state) => state.bootstrapping);
  const meta = VIEW_TITLES[view] ?? VIEW_TITLES.jobs;

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label={mobileOpen ? "关闭导航" : "打开导航"}
          aria-expanded={mobileOpen}
          onClick={onToggleMobile}
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
            <path d="M5 6h14M5 12h14M5 18h14" />
          </svg>
        </button>
        <div>
          <p className="eyebrow">{meta.eyebrow}</p>
          <h1>{meta.title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="date-stamp">{todayLabel}</span>
        <span className="api-status" data-state={status}>
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">{statusText}</span>
        </span>
        <IconButton
          icon="refresh"
          label="刷新数据"
          title="刷新数据"
          disabled={bootstrapping}
          onClick={() => void refreshAll()}
        />
      </div>
    </header>
  );
}
