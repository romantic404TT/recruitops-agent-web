import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SectionHeading, MiniStat } from "@/components/ui/Section";
import { EmptyState, LoadingRows } from "@/components/ui/States";
import { mailDateTime, text } from "@/lib/format";
import {
  mailAssociationState,
  mailCategoryLabel,
  mailConfidenceLabel,
  mailFreshnessError,
  mailFreshnessStatus,
  mailProcessingLabel,
  mailProcessingTone,
  normalizeMailStatus,
} from "@/lib/mail";
import { useMailsStore } from "@/stores/mails";
import type { RecruitmentMail } from "@/types/mail";

function MailRow({ mail }: { mail: RecruitmentMail }) {
  const navigate = useNavigate();
  const requestReview = useMailsStore((state) => state.requestReview);
  const processingStatus = normalizeMailStatus(mail.processing_status) || "pending";
  const association = mailAssociationState(mail);
  const target = [mail.company_name, mail.job_title].filter(Boolean).join(" · ");
  return (
    <article className="mail-row">
      <div className="mail-row-main">
        <strong className="mail-subject">{text(mail.subject, "无主题")}</strong>
        <div className="mail-tags">
          <span className="mail-tag mail-tag--category">{mailCategoryLabel(mail.category)}</span>
          <span className="mail-tag mail-tag--muted">{`置信度 ${mailConfidenceLabel(mail.confidence)}`}</span>
          <span className={`mail-tag mail-tag--${mailProcessingTone(processingStatus)}`} data-status={processingStatus}>
            {`处理：${mailProcessingLabel(processingStatus)}`}
          </span>
          <span className={`mail-tag mail-tag--${association.key}`} data-status={association.key}>
            {`关联：${association.label}`}
          </span>
        </div>
        <span className="mail-sender">{text(mail.sender, "发件人待确认")}</span>
        {target ? <span className="mail-target">{`投递目标：${target}`}</span> : null}
        <span className="mail-sender">{mailDateTime(mail.received_at)}</span>
      </div>
      <div className="mail-row-actions">
        <Button variant="ghost" onClick={() => navigate(`/mail/${encodeURIComponent(String(mail.id))}`)}>
          查看邮件
        </Button>
        <Button variant="secondary" onClick={() => void requestReview(String(mail.id))}>
          生成关联预览
        </Button>
      </div>
    </article>
  );
}

export default function MailPage() {
  const items = useMailsStore((state) => state.items);
  const unavailable = useMailsStore((state) => state.unavailable);
  const freshness = useMailsStore((state) => state.freshness);
  const sync = useMailsStore((state) => state.sync);
  const loading = useMailsStore((state) => state.loading);
  const review = useMailsStore((state) => state.review);
  const reviewFor = useMailsStore((state) => state.reviewFor);
  const load = useMailsStore((state) => state.load);
  const syncNow = useMailsStore((state) => state.syncNow);

  useEffect(() => {
    if (!items.length) void load();
  }, [items.length, load]);

  const freshnessState = mailFreshnessStatus(freshness, unavailable);
  const confirmCount = items.filter((item) => item.requires_confirmation).length;
  const linkedCount = items.filter((item) => item.application_id).length;

  const freshnessCopy: Record<string, [string, string]> = {
    synced: ["邮箱数据已同步", freshness.synced_at ? `最近同步于 ${mailDateTime(freshness.synced_at)}` : "已完成最近一次邮箱同步。"],
    cached: ["当前显示本地缓存", freshness.synced_at ? `最近一次同步于 ${mailDateTime(freshness.synced_at)}，尚未确认最新邮件。` : "尚未确认最新邮件，当前列表来自本地缓存。"],
    failed: ["同步失败，当前显示缓存", items.length ? `${mailFreshnessError(freshness)}；邮件列表可能不是最新。` : `${mailFreshnessError(freshness)}；暂无可用的本地邮件缓存。`],
    disabled: ["邮箱同步未启用", items.length ? "当前显示本地已保存的邮件，请先启用只读邮箱连接。" : "请在本机配置只读邮箱连接后再同步。"],
  };

  return (
    <section className="view-panel is-visible" data-view-panel="mail" aria-labelledby="mail-heading">
      <SectionHeading
        eyebrow="只读邮件情报"
        titleId="mail-heading"
        title="招聘邮箱"
        description="查看已同步的招聘邮件；关联与日程变更只生成审批预览。"
        actions={
          <Button variant="secondary" disabled={sync.status === "syncing"} onClick={() => void syncNow()}>
            {sync.status === "syncing" ? "同步中..." : "同步邮件"}
          </Button>
        }
      />
      <div className="mail-status-stack" aria-live="polite">
        {sync.status !== "idle" ? (
          <div className="mail-sync-status" data-state={sync.status}>
            <span className="mail-status-indicator" aria-hidden="true" />
            <div>
              <strong>
                {sync.status === "syncing"
                  ? "正在同步招聘邮件"
                  : sync.status === "success"
                    ? "招聘邮件同步完成"
                    : "邮箱同步未完成"}
              </strong>
              <span>
                {sync.status === "syncing"
                  ? "正在从只读邮箱读取新邮件，请稍候。"
                  : sync.status === "success"
                    ? `读取 ${sync.fetched} 封，新增 ${sync.inserted} 封，复用 ${sync.reused} 封。`
                    : sync.error}
              </span>
            </div>
          </div>
        ) : null}
        {freshnessState !== "unknown" && freshnessCopy[freshnessState] ? (
          <div className="mail-freshness-note" data-state={freshnessState}>
            <span className="mail-status-indicator" aria-hidden="true" />
            <div>
              <strong>{freshnessCopy[freshnessState][0]}</strong>
              <span>{freshnessCopy[freshnessState][1]}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="company-metrics" aria-label="招聘邮件摘要">
        <MiniStat label="当前列表" value={items.length} />
        <MiniStat label="待确认" value={confirmCount} />
        <MiniStat label="已关联" value={linkedCount} />
      </div>

      <section className="workspace-section" aria-labelledby="mail-list-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">本地解析结果</p>
            <h3 id="mail-list-heading">邮件列表</h3>
          </div>
          <span className="muted-label">{loading ? "加载中" : `${items.length} 封`}</span>
        </div>
        <div className="mail-list" data-state={loading ? "loading" : "ready"}>
          {loading && !items.length ? <LoadingRows rows={3} /> : null}
          {!loading && unavailable && !items.length ? (
            <EmptyState title="招聘邮箱尚未连接" detail="请在本机配置只读邮箱连接并执行同步任务。" />
          ) : null}
          {!loading && !unavailable && !items.length ? (
            <EmptyState title="暂无招聘邮件" detail="同步后会在这里显示分类和关联状态。" />
          ) : null}
          {items.map((mail) => <MailRow key={mail.id} mail={mail} />)}
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="mail-preview-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">人工确认前</p>
            <h3 id="mail-preview-heading">关联预览</h3>
          </div>
        </div>
        <div className="task-result" data-state={review ? "ready" : "empty"}>
          {!review ? (
            <EmptyState title="尚未选择邮件" detail="选择一封邮件生成投递阶段与日程草稿。" />
          ) : (
            <>
              <p className="configuration-hint">{`来源邮件：${reviewFor} · 处理态：${mailProcessingLabel(review.processing_status)}`}</p>
              {review.stage_change ? (
                <div className="result-block">
                  <h4 className="result-block-title">投递阶段变更建议</h4>
                  <pre>{JSON.stringify(review.stage_change, null, 2)}</pre>
                </div>
              ) : null}
              {review.schedule_drafts?.length ? (
                <div className="result-block">
                  <h4 className="result-block-title">日程草稿</h4>
                  <ul>{review.schedule_drafts.map((draft, index) => <li key={index}>{text(draft.title)}</li>)}</ul>
                </div>
              ) : null}
              {review.previews?.length ? (
                <div className="result-block">
                  <h4 className="result-block-title">审批预览（未登记）</h4>
                  <pre>{JSON.stringify(review.previews, null, 2)}</pre>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
      <Outlet />
    </section>
  );
}
