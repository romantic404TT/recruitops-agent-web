import { NavLink } from "react-router-dom";
import { SlidersIcon, UiIcon, type UiIconName } from "@/components/ui/UiIcon";
import { useNavCounts, type NavCountKey } from "@/stores/navCounts";

interface NavEntry {
  to: string;
  label: string;
  icon?: UiIconName;
  countKey?: NavCountKey;
}

/** 上游 index.html:24-82 的导航结构与顺序，分组标题也照搬。 */
const PRIMARY_NAV: { group?: string; items: NavEntry[] }[] = [
  { items: [{ to: "/configuration", label: "配置", icon: "sliders" }] },
  {
    group: "发现",
    items: [
      { to: "/jobs", label: "27届校招", icon: "briefcase", countKey: "jobs" },
      { to: "/companies", label: "公司", icon: "building" },
    ],
  },
  {
    group: "我的",
    items: [
      { to: "/assistant", label: "求职助理", icon: "chat" },
      { to: "/applications", label: "投递记录", icon: "file", countKey: "applications" },
      { to: "/schedule", label: "日程安排", icon: "calendar", countKey: "schedule" },
      { to: "/automations", label: "定时任务", icon: "timer", countKey: "automations" },
      { to: "/mail", label: "招聘邮箱", icon: "mail", countKey: "mails" },
    ],
  },
];

const SYSTEM_NAV: NavEntry[] = [
  { to: "/approvals", label: "待确认事项", icon: "shield", countKey: "approvals" },
  { to: "/tasks", label: "运行记录", icon: "list", countKey: "tasks" },
  { to: "/integrations", label: "数据接入", icon: "link" },
];

function NavItem({ entry }: { entry: NavEntry }) {
  const counts = useNavCounts();
  const count = entry.countKey ? counts[entry.countKey] : null;
  return (
    <NavLink
      to={entry.to}
      className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}
    >
      <span className="nav-symbol" aria-hidden="true">
        {entry.icon === "sliders" ? <SlidersIcon /> : entry.icon ? <UiIcon name={entry.icon} /> : null}
      </span>
      <span>{entry.label}</span>
      {count !== null && count !== undefined ? (
        <span className="nav-count">{count}</span>
      ) : null}
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate: () => void }) {
  return (
    <aside
      className={`sidebar${mobileOpen ? " is-open" : ""}`}
      aria-label="主导航"
    >
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          R
        </div>
        <div>
          <p className="brand-name">秋招工作台</p>
          <p className="brand-caption">发现机会，稳步推进</p>
        </div>
      </div>

      <nav className="primary-nav" aria-label="工作台导航">
        {PRIMARY_NAV.map((section) => (
          <div key={section.group ?? "top"} className="nav-section">
            {section.group ? <p className="nav-group-label">{section.group}</p> : null}
            {section.items.map((entry) => (
              <NavItem key={entry.to} entry={entry} />
            ))}
          </div>
        ))}
      </nav>

      <details className="system-nav">
        <summary>
          <span className="nav-symbol" aria-hidden="true">
            <UiIcon name="settings" />
          </span>
          <span>系统</span>
        </summary>
        <div className="system-nav-items">
          {SYSTEM_NAV.map((entry) => (
            <NavItem key={entry.to} entry={entry} />
          ))}
        </div>
      </details>

      <div className="sidebar-footer">
        <div className="read-only-note">
          <span className="status-dot status-dot--ok" aria-hidden="true" />
          <span>本机服务</span>
        </div>
      </div>

      {/* 移动抽屉里点任意导航即收起 */}
      {mobileOpen ? (
        <button
          type="button"
          className="sr-only"
          aria-label="关闭导航"
          onClick={onNavigate}
        />
      ) : null}
    </aside>
  );
}
