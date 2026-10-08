# 秋招工作台 · RecruitOps Agent（React 复刻版）

复刻自 <https://github.com/849879772/recruitops-agent> 的 `apps/web`（原生 JS 单页应用），
改写为 **Vite + React 18 + TypeScript + React Router + Tailwind + Zustand + MSW** 工程。
上游全部 `/api/*` 调用改为本机 MSW mock，**不需要 Python 后端、PostgreSQL 或 Docker 即可运行**。

---

## 一、安装与启动

```bash
npm install          # 194 个包 / 约 101MB / 约 40 秒
npm run dev          # http://127.0.0.1:5330
```

浏览器打开 <http://127.0.0.1:5330/>，首屏即进入「27届校招」岗位列表，带完整 mock 数据。

> 端口钉死 5330（dev）/ 4330（preview）并开启 `strictPort`。
> 本机长期有多个 Vite dev server 并存（5173 / 5180 / 5188 / 5190 / 5199 / 5320 已占用），
> 若不钉端口，Vite 会静默顺延，容易误测到别的项目。端口冲突时会显式报错而不是换号。

## 二、构建与预览

```bash
npm run build        # tsc --noEmit + vite build → dist/
npm run preview      # http://127.0.0.1:4330
```

`npm run build` 会先做全量类型检查，**有类型错误就不会出包**。

## 三、部署

`dist/` 是纯静态产物，任意静态托管都行（Nginx / GitHub Pages / Vercel / Netlify / 对象存储）。

```bash
npm run build
# 把 dist/ 整个目录交给静态托管；子路径部署时改 vite.config.ts 的 base
```

两点必须知道：

1. **部署包里不含 mock。** `src/main.tsx` 里 mock 的开关是 `import.meta.env.DEV`（编译期常量），
   生产构建会把整个 `@/mocks/browser` 分支连同 msw 依赖一起摇树掉。
   产物实测：入口 64.14KB、路由块 207.35KB、CSS 37.28KB，**没有任何 msw chunk**。
   所以直接部署 `dist/` 会打开一个所有接口 404 的空壳。要在部署环境保留演示数据，用：
   ```bash
   VITE_USE_MOCKS=1 npm run build
   ```
2. **部署到子路径时**要同时设 `base` 与 MSW 的 worker 地址：worker 走的是
   `${import.meta.env.BASE_URL}mockServiceWorker.js`，`base` 改对了它就对。

SPA 路由需要托管端把未知路径回退到 `index.html`，例如 Nginx：

```nginx
location / { try_files $uri $uri/ /index.html; }
```

## 四、其它脚本

```bash
npm run typecheck          # 只跑 tsc --noEmit（src）
npm run typecheck:config   # 只检查 vite.config.ts / tailwind.config.ts
npm run msw:init           # 重新生成 public/mockServiceWorker.js
node verify/probe.mjs      # 无头 Edge 逐路由验收（见第七节）
```

---

## 五、目录结构

```
recruitops-agent-web/
├─ package.json  vite.config.ts  tsconfig.json  tsconfig.node.json
├─ tailwind.config.ts  postcss.config.js  index.html  .gitignore
├─ public/mockServiceWorker.js
├─ verify/probe.mjs                      # 验收探针（不参与构建）
└─ src/
   ├─ main.tsx                           # 入口：先起 MSW，再挂 React
   ├─ router.tsx                         # 12 视图 + 5 模态路由，全部 lazy 分包
   ├─ index.css                          # Tailwind + 上游类名与 :root 令牌
   ├─ vite-env.d.ts
   ├─ types/                             # 与上游 Pydantic 模型一一对齐
   │  ├─ domain.ts          # Company/Job/JobBrowse*/Application/ScheduleEvent/Approval/TaskRun/ToolCall
   │  ├─ codex.ts           # 线程/回合/事件/轨迹（含 camelCase 与 snake_case 双写）
   │  ├─ mail.ts  automation.ts  companySource.ts  configuration.ts  localUi.ts  assistant.ts
   ├─ lib/
   │  ├─ http.ts            # 复刻 app.js:200 的 api()：detail 抛错语义 + 30/60s 超时
   │  ├─ labels.ts          # 全部中文文案常量（TASK/STATUS/STAGE/MAIL/AUTOMATION/SCHEDULE/INTENT…）
   │  ├─ format.ts          # 日期、分数、日程分组、Codex 字段兜底等纯函数
   │  ├─ mail.ts            # 邮件处理态/关联态/新鲜度派生
   │  └─ sse.ts             # SSE 分帧、去重栅栏、eventDetail 取值优先级
   ├─ stores/                            # Zustand：上游单个可变 state 拆成分域 store
   │  ├─ system.ts          # boot()：上游 loadCore 的 9 请求并发 + 降级分组 + 指标
   │  ├─ jobs.ts companies.ts applications.ts schedule.ts automations.ts
   │  ├─ mails.ts approvals.ts tasks.ts assistant.ts configuration.ts
   │  ├─ companySources.ts  navCounts.ts  toast.ts
   ├─ components/
   │  ├─ layout/            # AppShell / Sidebar / Topbar / OnboardingNotice / RouteFallback
   │  ├─ ui/                # Button / Section / States / ScoreBadge / Dialog / Pager / Toast / UiIcon
   │  └─ jobs|dashboard|automations/…     # 视图私有组件
   ├─ pages/                             # 12 个视图，与上游 data-view 一一对应
   └─ dialogs/                           # 5 个弹层，升级为真实 URL
└─ src/mocks/
   ├─ browser.ts            # setupWorker + onUnhandledRequest: bypass
   ├─ db.ts                 # 可变内存库（写操作能刷新后仍在）
   ├─ query.ts              # /api/jobs/browse 的过滤→统计→分面→排序→分页引擎
   ├─ handlers/             # 55 条 handler，按域分 6 个文件
   └─ data/                 # fixture 工厂（日期相对运行时计算）
```

## 六、路由

上游没有路由：12 个 `<button data-view>` 切 `hidden` 属性，URL 恒定、刷新即丢视图。
复刻版全部升级为真实 URL，可直链、可前进后退、刷新不丢状态。

| 路径 | 视图 | 上游对应 |
|---|---|---|
| `/jobs` | 27届校招（默认首页，`/` 重定向到此） | `data-view="jobs"` |
| `/jobs/:jobId` | 岗位详情弹层 | `#job-detail-dialog` |
| `/companies` | 公司排行 | `#companies-view` |
| `/assistant` | 求职助理 | `#assistant-view` |
| `/applications` | 投递看板 | `#applications-view` |
| `/applications/new` | 手动添加投递 | `#application-create-dialog` |
| `/schedule` | 日程（待办/月历） | `#schedule-view` |
| `/schedule/new`、`/schedule/edit/:eventId` | 日程编辑 | `#schedule-editor-dialog` |
| `/automations` | 定时任务 | `#automations-view` |
| `/automations/:automationId` | 执行详情 | `#automation-detail-dialog` |
| `/mail` | 招聘邮箱 | `#mail-view` |
| `/mail/:mailId` | 邮件正文 | 复用 `#job-detail-dialog` |
| `/approvals` | 审批中心 | `#approvals-view` |
| `/tasks` | 运行记录 | `#tasks-view` |
| `/configuration` | 个人配置 | `#configuration-view` |
| `/integrations` | 数据接入 | `#integrations-view` + company-sources.js 注入区 |
| `/dashboard` | 今日工作台 | `#dashboard-view` |

## 七、Mock 覆盖情况

**55 条 handler（实测 grep 计数），覆盖上游前端实际调用的全部端点**，路径、方法、请求体、错误码都按 `apps/api/*.py` 的真实契约实现：

| 域 | 端点 |
|---|---|
| 系统 | `GET /health`、`GET /ready`、`GET /api/reports/operational` |
| 岗位 | `GET /api/jobs`、`/api/jobs/browse`（过滤/排序/分页/分面/统计/featured 全实现）、`/api/jobs/:id` |
| 公司 | `GET /api/companies` |
| 投递 | `GET /api/applications`、`/api/applications/page`；`POST /api/local-ui/applications`、`/manual`；`PATCH /{id}`、`/{id}/record-url`；`DELETE /{id}`；`POST /{id}/events` |
| 日程 | `GET /api/schedule`（含 `?on=`）、`POST /api/local-ui/events`、`PATCH /api/local-ui/events/:id` |
| 邮件 | `GET /api/recruitment-mails`、`/{id}`；`POST /sync`、`/{id}/review` |
| 定时任务 | `GET /api/automations`、`POST /{id}/disable` |
| 审批 | `GET|POST /api/approvals`、`POST /{id}/approve`、`/reject`、`/execute` |
| Codex | `GET /api/codex/health`、`/mcp-status`、`/traces`、`/threads`、`/threads/{id}`；`POST /threads`、`/resume`、`/turns`、`/turns/stream`（**真 SSE 流**）、`/interrupt`、`GET /threads/{id}/events`；`DELETE /threads/{id}` |
| 数据接入 | `GET /api/company-sources`、`/{id}`、`/{id}/jobs`；`PATCH /{id}/entry`、`POST /{id}/retry` |
| 配置 | `POST /api/local-ui/configuration/` + `read`、`save`、`model/test`、`mail/test`、`resume`、`resume/parse`、`applications/import`、`latest-crawl` |

**保留的真实拒绝路径**（不是所有请求都成功）：

- 缺 `X-RecruitOps-Local-UI: 1` → `403 Local same-origin UI request required`（已实测）
- `expected_updated_at` 与库中不符 → `409 Record changed; refresh and retry`（投递/日程/来源入口三处）
- 重复幂等键登记审批 → `409`；未批准就执行 → `409`；令牌已用过 → `409`
- 简历正文为空 → `422`；CSV 表头缺列 → `422`；`status` 参数不在枚举内 → `422`
- 邮箱未配置时 `POST /sync` → `status:"skipped"` + `freshness:"disabled"`（前端据此显示「邮箱同步未启用」）

**写操作真的会改状态**：改投递阶段、加/改/完成日程、批准并执行审批（会把 `preview.after` 落到投递上并追加阶段历史）、停用定时任务、改来源入口地址、导入 CSV/JSON、保存配置 —— 全部即时反映到界面，刷新后仍在（内存库在页面整页刷新时重新播种，等价于重启本机服务）。

## 八、哪些是假的（重要）

这一节决定你怎么看这个复刻版。**界面和数据流是真的，智能不是。**

1. **求职助理不会真的查数据。** `POST /turns/stream` 返回的是**按关键词模板化的剧本**：
   它会真的从 mock 库里数出「待处理日程 N 项」「进行中的投递 N 条」这类数字，
   但回答文本是模板，不是模型生成的。上游这里跑的是 Codex App Server + 大模型。
2. **简历分析不解析简历。** `/resume/parse` 是在上传的文本里做关键词命中（Go/C++/Kubernetes…）
   和正则取项目行。传一份真简历不会得到真分析。上游调用的是模型。
3. **模型连接测试是本地校验。** `/model/test` 只检查地址格式、模型名、密钥是否缺失，
   **不会真的向 DeepSeek 发请求**。上游会真实验证鉴权与结构化输出。
4. **邮箱同步不读邮箱。** 没有 IMAP。`/sync` 在「已配置」时返回一份假的计数统计。
5. **抓取与评分不会发生。** 岗位、分数、优势/短板全部是 fixture。
   `/api/company-sources/:id/retry` 只把状态改成 `running`，不会去抓任何网站。
6. **审批执行不落库。** 写的是内存对象，整页刷新即回滚到初始 fixture。
7. **上游 Electron 桌面版独有能力未复刻**：`window.recruitopsDesktop.applySavedConfiguration()`
   （保存配置后自动重启本机服务）。复刻版走的是上游已有的降级分支，直接显示 `result.message`。
8. **未复刻的上游表面**：`apps/desktop`（Electron 主进程 + renderer）、`extension/`（Chrome MV3 扩展）。
   本次范围按确认只做 `apps/web`。

## 九、验证记录

2026-09-24 首次全量验收；**2026-10-08 重启复验通过**（跨天回归检查：fixture 日期是运行时计算的，
新日期下 12 条路由数据量与报错数与首验一致）。

复验时发现并修复了一处真实缺陷：首页「今日新增」指标卡显示 7，但同页的今日新增列表与待办卡为空。
根因是把上游 `loadCore()` 中「同一个 `/api/jobs/browse` 响应同时喂指标和列表」拆成两次 store 加载时
漏接了列表那一路。现已改为复用同一份 payload，并补了一条**跨区块一致性断言**：

```
今日新增指标 = 7 | 今日新增列表行数 = 7 | 空态 = 0 | 报错 = 0
```

（此前的探针只数 `.todo-card` 是否命中 4 个，空态也是合法节点，所以计数照样达标 —— 这类
「数字与内容对不上」的 bug 只有看图或写等式断言才拦得住。）

| 项目 | 结果 |
|---|---|
| `npm install` | 194 包 / 101MB / 37 秒，exit 0 |
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | 320 modules → 25 chunks，`✓ built in 4.41s`，exit 0 |
| 生产包是否含 msw | 否（无 msw chunk；入口 64.14KB / gzip 24.90KB） |
| dev server | `VITE v5.4.11 ready in 678 ms` @ 127.0.0.1:5330，`<title>` 断言通过 |
| `mockServiceWorker.js` | HTTP 200 |
| 12 条路由渲染 | 全部命中真实 mock 数据，见下表 |
| 页面 JS 异常 | 0 个 `pageerror` |
| 控制台 error | 修复前 `/jobs` 有 1 条 favicon 404，已通过内联 SVG favicon 消除 |

无头 Edge（`playwright-core` + 本机 msedge，零新增依赖）逐路由取证：

| 路由 | 命中的结构节点数 | 页面标题 |
|---|---|---|
| `/jobs` | 17 行岗位 | 27届校招岗位 |
| `/dashboard` | 4 张待办卡 | 今日工作台 |
| `/companies` | 14 行公司 | 公司 |
| `/applications` | 12 张投递卡 | 投递记录 |
| `/schedule` | 7 条日程项 | 日程安排 |
| `/automations` | 5 个任务 | 定时任务 |
| `/mail` | 10 封邮件 | 招聘邮箱 |
| `/approvals` | 6 张审批卡 | 审批中心 |
| `/tasks` | 8 条轨迹 | 任务轨迹 |
| `/integrations` | 10 条来源 | 数据接入 |
| `/assistant` | 5 个快捷入口 | 求职助理 |
| `/configuration` | 2 个模型连接 | 个人配置 |

接口直连（在页面主世界 `fetch`，真实经过 MSW service worker）：
`/health`、`/api/jobs/browse`、`/api/jobs/job-1001`、`/api/companies`、`/api/applications/page`、
`/api/schedule`、`/api/automations`、`/api/recruitment-mails`、`/api/approvals`、
`/api/codex/traces`、`/api/codex/health`、`/api/codex/threads`、`/api/company-sources`、
`/api/reports/operational` 全部 200 且响应壳字段与上游一致；
`POST /configuration/read`、`/latest-crawl` 200；
缺标记头的写请求 403。

复跑验收：

```bash
npm run dev &            # 另开终端
node verify/probe.mjs    # 需要本机装有 Edge
```

截图落在 `verify/out/*.png`。

**未能自动验收的部分**（无头环境限制，需人工过一遍）：SSE 逐字增量的观感与「停止」按钮的中断手感、
原生 `<dialog>` 的 ESC 与 backdrop 点击、拖拽/滚动位置、CSV 模板下载、剪贴板复制审批令牌、
移动端抽屉的动画手感。

## 十、与原项目的差异

| 维度 | 上游 `apps/web` | 本复刻 |
|---|---|---|
| 框架 | 无（原生 JS，无构建步骤） | React 18 + TS + Vite |
| 视图切换 | `data-view` + `hidden`，URL 不变 | React Router，12 视图 + 5 模态路由 |
| 状态 | 单个可变 `state`（约 45 字段） | Zustand 分域 store，保留 `requestId` 竞态防护 |
| 渲染 | 34 个 `render*` 命令式改 DOM | 组件树 + 声明式渲染 |
| 样式 | `styles.css` 5,660 行 | Tailwind + 同名类名（便于与原项目逐块比对） |
| 后端 | FastAPI + PostgreSQL + Codex | MSW 55 条 handler + 内存库 |
| 会话持久化 | `localStorage`（脱敏后落盘） | 同一套键名与脱敏规则，直接沿用 |

刻意保留的上游细节：`api()` 的 `detail` 抛错语义、`X-RecruitOps-Local-UI` 标记头、
`AbortSignal.timeout` 的 30/60 秒分档、`requestId` 竞态丢弃、`visibleJobs` 的 5 个排除态、
`scoreBadge` 在 `analysis_status !== "complete"` 时不显示分数、日程「未填日期不得填时间」的两处校验、
审批执行前 `window.prompt` 索取操作人、剪贴板失败退回 `window.prompt`、
Codex 三条运行时限英文报错的中文改写、402 余额不足的专门翻译、SSE 断线两次重连 + 重放栅栏去重。

## 十一、许可

上游仓库带 `LICENSE`（MIT）。本复刻沿用同一许可，代码为按 `apps/web` 行为重写，非逐行拷贝。
