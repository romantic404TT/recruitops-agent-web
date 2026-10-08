import { useNavigate, useParams } from "react-router-dom";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { automationDateTime, automationDuration, text } from "@/lib/format";
import { AUTOMATION_STATUS_LABELS } from "@/lib/labels";
import { useAutomationsStore } from "@/stores/automations";
import { useAssistantStore } from "@/stores/assistant";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="automation-detail-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function AutomationDetailDialog() {
  const navigate = useNavigate();
  const { automationId } = useParams<{ automationId: string }>();
  const automation = useAutomationsStore((state) => state.items).find((item) => item.id === automationId);
  const setContext = useAssistantStore((state) => state.setContext);
  const close = () => navigate("/automations", { replace: true });

  if (!automation) {
    return (
      <Dialog open onClose={close} labelledby="automation-detail-title" kicker="最近一次执行" title="任务详情" className="automation-detail-dialog">
        <EmptyState title="任务不存在" detail="它可能已被停用或删除。" />
      </Dialog>
    );
  }

  const latest = automation.latest_execution ?? null;
  const status = text(latest?.status ?? automation.last_status, automation.active ? "active" : "inactive");
  const abnormal = ["failed", "blocked"].includes(status);

  return (
    <Dialog
      open
      onClose={close}
      className="automation-detail-dialog"
      labelledby="automation-detail-title"
      kicker="最近一次执行"
      title={text(automation.task_label, "任务详情")}
    >
      <div className="job-detail-content automation-detail-content">
        <dl className="automation-detail-facts">
          <Fact label="执行状态" value={AUTOMATION_STATUS_LABELS[status] || (automation.active ? "已启用" : "已停用")} />
          <Fact label="执行目标" value={text(automation.target_label, automation.target_kind === "all" ? "全部目标" : "目标待确认")} />
          <Fact label="计划时间" value={`${automation.frequency === "daily" ? "每天" : text(automation.frequency)} ${text(automation.start_time, "--:--")} · ${text(automation.timezone, "Asia/Shanghai")}`} />
          <Fact label="计划触发" value={automationDateTime(latest?.scheduled_for)} />
          <Fact label="开始时间" value={automationDateTime(latest?.started_at)} />
          <Fact label="结束时间" value={automationDateTime(latest?.completed_at)} />
          <Fact label="执行耗时" value={automationDuration(latest?.started_at, latest?.completed_at)} />
          <Fact label="执行 ID" value={text(latest?.id, "尚未执行")} />
        </dl>
        {latest?.error || automation.last_error ? (
          <section className="automation-detail-alert">
            <h3>错误信息</h3>
            <p>{text(latest?.error ?? automation.last_error)}</p>
          </section>
        ) : null}
        <section className="automation-detail-result">
          <h3>执行结果</h3>
          <pre>{text(latest?.result_summary, latest ? "本次执行没有返回摘要。" : "该任务尚未执行。")}</pre>
        </section>
      </div>
      <DialogActions>
        {abnormal ? (
          <Button
            variant="primary"
            onClick={() => {
              const prompt = [
                `请解释定时任务“${text(automation.task_label, automation.task_id)}”最近一次执行为什么显示“${AUTOMATION_STATUS_LABELS[status] || status}”。`,
                `执行 ID：${text(latest?.id, "无")}`,
                `执行状态：${status}`,
                `开始时间：${automationDateTime(latest?.started_at)}`,
                `结束时间：${automationDateTime(latest?.completed_at)}`,
                `系统错误：${text(latest?.error ?? automation.last_error, "无")}`,
                `执行摘要：\n${text(latest?.result_summary, "无")}`,
                "只根据上述这一次执行记录解释，不要重新运行任务。请用中文说明直接原因、实际完成情况、影响范围和下一步操作，并区分任务失败与部分记录需要人工处理。",
              ].join("\n");
              setContext({ last_task_type: "automation_explain" });
              close();
              navigate(`/assistant?draft=${encodeURIComponent(prompt.slice(0, 7000))}`);
            }}
          >
            让助理解释
          </Button>
        ) : null}
        <Button variant="ghost" onClick={close}>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
}
