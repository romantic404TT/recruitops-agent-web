import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, IconButton } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { EmptyState, LoadingRows } from "@/components/ui/States";
import { approvalEvidenceText, approvalPreviewJson, useApprovalsStore } from "@/stores/approvals";
import { useSystemStore } from "@/stores/system";
import type { FlatApproval } from "@/types/domain";

function ApprovalCard({ approval }: { approval: FlatApproval }) {
  const decide = useApprovalsStore((state) => state.decide);
  const execute = useApprovalsStore((state) => state.execute);
  const copyToken = useApprovalsStore((state) => state.copyToken);
  const refreshBusinessData = useSystemStore((state) => state.refreshBusinessData);
  const pageUrl = approval.preview?.payload?.page_url;
  const isBrowserAction = approval.operation === "browser_action";

  return (
    <article className="approval-card">
      <strong>{`${approval.operation} · ${approval.status}`}</strong>
      <p>{`任务 ${approval.task_id} · 幂等键 ${approval.idempotency_key}`}</p>
      {approval.preview ? (
        <>
          <p className="approval-evidence">{approvalEvidenceText(approval)}</p>
          <pre className="approval-preview">{approvalPreviewJson(approval)}</pre>
        </>
      ) : null}
      {approval.status === "pending" ? (
        <div className="inline-actions">
          <Button variant="primary" onClick={() => void decide(approval.token_id, "approve").then(refreshBusinessData)}>
            批准预览
          </Button>
          <Button variant="ghost" onClick={() => void decide(approval.token_id, "reject")}>
            拒绝
          </Button>
        </div>
      ) : approval.status === "approved" && isBrowserAction ? (
        <div className="inline-actions">
          {typeof pageUrl === "string" && /^https?:\/\//i.test(pageUrl) ? (
            <a className="button button--ghost" href={pageUrl} target="_blank" rel="noopener noreferrer">
              打开待复核页面
            </a>
          ) : null}
          <Button variant="primary" onClick={() => void copyToken(approval.token_id)}>
            复制单次令牌
          </Button>
        </div>
      ) : approval.status === "approved" ? (
        <div className="inline-actions">
          <Button variant="primary" onClick={() => void execute(approval.token_id)}>
            执行已批准操作
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export default function ApprovalsPage() {
  const items = useApprovalsStore((state) => state.items);
  const load = useApprovalsStore((state) => state.load);
  const navigate = useNavigate();
  useEffect(() => {
    if (!items.length) void load();
  }, [items.length, load]);
  const pending = items.filter((item) => item.status === "pending").length;

  return (
    <section className="view-panel is-visible" data-view-panel="approvals" aria-labelledby="approvals-heading">
      <SectionHeading
        eyebrow="人工确认边界"
        titleId="approvals-heading"
        title="审批中心"
        description="先核对并批准预览，再使用本机令牌执行一次；每次写入都会备份并留下审计记录。"
        actions={
          <IconButton icon="refresh" label="刷新审批" title="刷新审批" onClick={() => void load()} />
        }
      />
      <div className="approval-summary">
        <span className="summary-number">{pending}</span>
        <span>
          <strong>待处理审批</strong>
          <small>操作前请核对证据和幂等键</small>
        </span>
      </div>
      <div className="workspace-section approval-section">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">操作预览</p>
            <h3>审批列表</h3>
          </div>
          <span className="muted-label">{`${items.length} 条`}</span>
        </div>
        <div className="approval-list" data-state={items.length ? "ready" : "loading"}>
          {!items.length ? <LoadingRows rows={3} /> : null}
          {items.length === 0 && false ? <EmptyState title="暂无审批请求" detail="只读任务不会自动生成写操作。" /> : null}
          {items.map((approval) => <ApprovalCard key={approval.token_id} approval={approval} />)}
        </div>
        {!items.length ? (
          <p className="configuration-hint">
            只读任务不会自动生成写操作。
            <button type="button" className="text-button" onClick={() => navigate("/assistant")}>
              去助理发起一次
            </button>
          </p>
        ) : null}
      </div>
    </section>
  );
}
