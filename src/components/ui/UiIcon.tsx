/**
 * 上游 appendUiIcon 的 path 字典（app.js:271）。原项目所有线性图标都是
 * 单条 `<path>` 的 24×24 SVG，这里 1:1 保留，不引入图标库。
 */
export const UI_ICON_PATHS = {
  external:
    "M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  close: "m6 6 12 12M18 6 6 18",
  applied: "M4 7h16v13H4zM9 7V4h6v3M4 12h16M10 12v3h4v-3",
  written: "M8 4H5v17h14V4h-3M8 3h8v4H8zM8 12h8M8 16h5",
  interview: "M4 4h16v12H9l-5 4zM8 8h8M8 12h5",
  offer: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  list: "M5 6h14M5 12h14M5 18h14",
  calendar: "M3 5h18v16H3zM8 3v4M16 3v4M3 10h18",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l4 4L19 6",
  ignore: "M7 7l10 10M17 7 7 17",
  restore: "M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6",
  edit: "m4 16.5-.5 3.5 3.5-.5L18.7 7.3a2.4 2.4 0 0 0-3.4-3.4zM13.8 5.8l3.4 3.4",
  mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  "chevron-left": "m15 18-6-6 6-6",
  "chevron-right": "m9 18 6-6-6-6",
  refresh:
    "M20 11a8 8 0 0 0-14.7-3.9L4 9M4 5v4h4M4 13a8 8 0 0 0 14.7 3.9L20 15M20 19v-4h-4",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  settings:
    "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
  chat: "M4 5h16v11H8l-4 4z",
  briefcase:
    "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  building:
    "M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1",
  file: "M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6",
  timer: "M5 13a7 7 0 1 0 14 0a7 7 0 1 0-14 0M12 13V9M9 3h6M12 3v3",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4",
  link: "M10 13a4 4 0 0 0 5.7.3l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1M14 11a4 4 0 0 0-5.7-.3l-2 2A4 4 0 0 0 12 18.4l1.1-1.1",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z",
  clock: "M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 7v5l3 2",
  company:
    "M4 20V6l8-3 8 3v14M9 20v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01",
  jobDoc: "M4 7h16v12H4zM9 7V5h6v2M4 11h16M10 11v2h4v-2",
  sliders: "M4 7h16M4 17h16",
} as const;

export type UiIconName = keyof typeof UI_ICON_PATHS;

export interface UiIconProps {
  name: UiIconName;
  className?: string;
}

/** 描边风格与原项目一致：stroke=currentColor、width=1.75、round 端点。 */
export function UiIcon({ name, className }: UiIconProps) {
  const d = UI_ICON_PATHS[name];
  return (
    <svg
      className={className ?? "ui-icon"}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

/** 侧栏「配置」用的是双圆点描边图标，原样保留（index.html:25）。 */
export function SlidersIcon() {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path d="M4 7h16M4 17h16" />
      <circle cx={8} cy={7} r={3} fill="white" />
      <circle cx={16} cy={17} r={3} fill="white" />
    </svg>
  );
}
