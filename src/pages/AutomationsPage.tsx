import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button, IconButton } from "@/components/ui/Button";
import { SectionHeading, MiniStat } from "@/components/ui/Section";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/States";
import { AUTOMATION_STATUS_LABELS } from "@/lib/labels";
import { automationDateTime, text } from "@/lib/format";
import { useAutomationsStore } from "@/stores/automations";
import { useAssistantStore } from "@/stores/assistant";
import type { Automation } from "@/types/automation";
import { LatestCrawlReport } from "@/components/automations/LatestCrawlReport";

function AutomationItem({ automation }: { automation: Automation }) {
  const navigate = useNavigate();
  const disable = useAutomationsStore((state) => state.disable);
  const setAskDraft = useAssistantStore((state) => state.setContext);
  const latest: Partial<NonNullable<Automation["latest_execution"]>> = automation.latest_execution ?? {};
  const detailText = text(latest.error ?? automation.last_error ?? latest.result_summary, "尚无执行结果");
  const prompt = `调整定时任务“${text(automation.task_label, automation.task_id)}”，当前为每天 ${text(automation.start_time)} 执行。请先说明准备如何修改。`;

  return (
    <article className="automation-item">
      <div className="automation-item-heading">
        <div className="automation-item-title">
          <strong>{text(automation.task_label, "未命名任务")}</strong>
          <span>{text(automation.target_label, automation.target_kind === "all" ? "全部目标" : "目标待确认")}</span>
        </div>
        <span className="automation-status" data-state={automation.active ? text(automation.last_status, "active") : "inactive"}>
          {automation.active
            ? AUTOMATION_STATUS_LABELS[String(automation.last_status)] || "已启用"
            : "已停用"}
        </span>
      </div>
      <div className="automation-timing">
        <span>{`${automation.frequency === "daily" ? "每天" : text(automation.frequency)} ${text(automation.start_time, "--:--")} · ${text(automation.timezone, "Asia/Shanghai")}`}</span>
        <span>{automation.active ? `下次 ${automationDateTime(automation.next_run_at, "待计算")}` : "不再自动执行"}</span>
        <span>{`上次 ${automationDateTime(automation.last_run_at)}`}</span>
      </div>
      <p className="automation-result">{detailText.length > 240 ? `${detailText.slice(0, 240)}…` : detailText}</p>
      <div className="automation-actions">
        <Button variant="secondary" onClick={() => navigate(`/automations/${encodeURIComponent(automation.id)}`)}>
          详情
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAskDraft({ last_task_type: "automation_plan" });
            navigate(`/assistant?draft=${encodeURIComponent(prompt)}`);
          }}
        >
          交给助理调整
        </Button>
        {automation.active ? (
          <Button variant="secondary" onClick={() => void disable(automation.id, automation.task_label)}>
            停用
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function AutomationsPage() {
  const items = useAutomationsStore((state) => state.items);
  const total = useAutomationsStore((state) => state.total);
  const loading = useAutomationsStore((state) => state.loading);
  const error = useAutomationsStore((state) => state.error);
  const load = useAutomationsStore((state) => state.load);
  const [promptDraft, setPromptDraft] = useState("");

  useEffect(() => {
    if (!items.length) void load();
  }, [items.length, load]);

  useEffect(() => {
    const handler = (event: Event) => setPromptDraft((event as CustomEvent<string>).detail);
    document.addEventListener("recruitops:assistant-prompt", handler);
    return () => document.removeEventListener("recruitops:assistant-prompt", handler);
  }, []);

  const activeCount = items.filter((item) => item.active).length;
  const failedCount = items.filter((item) => ["failed", "blocked"].includes(String(item.last_status))).length;

  return (
    <section className="view-panel is-visible" data-view-panel="automations" aria-labelledby="automations-heading">
      <LatestCrawlReport />
      <SectionHeading
        eyebrow="本机持久化计划"
        titleId="automations-heading"
        title="定时任务"
        description="由求职助理创建的每日任务会保存在这里，并在本机服务运行时按时执行。"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPromptDraft("请帮我设置一个定时任务，先询问任务内容和每天执行时间。");
                useAssistantStore.getState().setContext({ last_task_type: "automation_plan" });
              }}
            >
              添加任务
            </Button>
            <IconButton icon="refresh" label="刷新定时任务" title="刷新定时任务" onClick={() => void load()} />
          </>
        }
      />
      {promptDraft ? <p className="configuration-hint">{`待填入助理输入框：${promptDraft}`}</p> : null}
      <div className="automation-summary" aria-label="定时任务摘要">
        <MiniStat label="任务总数" value={total} />
        <MiniStat label="正在运行" value={activeCount} />
        <MiniStat label="最近异常" value={failedCount} />
      </div>
      <section className="workspace-section" aria-labelledby="automation-list-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">执行计划</p>
            <h3 id="automation-list-heading">本地任务</h3>
          </div>
          <span className="muted-label">{loading ? "加载中" : error ? "加载失败" : `${items.length} 项`}</span>
        </div>
        <div className="automation-list" data-state={loading ? "loading" : "ready"}>
          {loading && !items.length ? <LoadingRows rows={2} /> : null}
          {!loading && error ? <ErrorState title="定时任务加载失败" detail={error} /> : null}
          {!loading && !error && !items.length ? (
            <EmptyState title="暂无定时任务" detail="可以让求职助理创建每天执行的本地任务。" />
          ) : null}
          {items.map((automation) => <AutomationItem key={automation.id} automation={automation} />)}
        </div>
      </section>
      <Outlet />
    </section>
  );
}
