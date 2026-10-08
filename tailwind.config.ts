import type { Config } from "tailwindcss";

/**
 * 设计令牌逐条搬自上游 apps/web/styles.css 的 `:root`（第 1-19 行）。
 * 上游后段还有一套同名变量的覆写（--accent 从 #168f83 改成 #0b6e69 等），
 * 这里保留两套：`teal` 为初值，`theme` 为级联生效后的最终值（组件实际取后者）。
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: {
          DEFAULT: "#f3f6f5",
          alt: "#f5f6fa",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f8fbfa",
          "subtle-alt": "#f7f9f9",
          teal: "#e6f4f1",
          "teal-alt": "#e5f2f0",
        },
        ink: {
          DEFAULT: "#172523",
          alt: "#1f2937",
          soft: "#38504c",
          "soft-alt": "#40515e",
        },
        muted: {
          DEFAULT: "#6e7d79",
          alt: "#6b7785",
          light: "#94a29e",
          "light-alt": "#9ca3af",
        },
        line: {
          DEFAULT: "#dbe5e2",
          alt: "#dfe5e7",
          strong: "#c7d6d2",
          "strong-alt": "#cfdadd",
        },
        accent: {
          DEFAULT: "#0b6e69",
          initial: "#168f83",
          dark: "#075b57",
          ink: "#064f4c",
        },
        state: {
          blue: "#47769b",
          amber: "#b47725",
          rose: "#aa5b64",
          danger: "#a13e48",
        },
        soft: {
          danger: "#f9ecee",
          success: "#e5f2f0",
        },
      },
      borderRadius: {
        ui: "6px",
      },
      width: {
        sidebar: "232px",
        "sidebar-narrow": "206px",
      },
      fontFamily: {
        ui: [
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [],
} satisfies Config;
