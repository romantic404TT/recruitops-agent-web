import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/States";
import { mailDateTime, text } from "@/lib/format";
import { mailProcessingLabel } from "@/lib/mail";
import { useMailsStore } from "@/stores/mails";
import type { RecruitmentMail } from "@/types/mail";

export default function MailDetailDialog() {
  const navigate = useNavigate();
  const { mailId } = useParams<{ mailId: string }>();
  const detail = useMailsStore((state) => state.detail);
  const openDetail = useMailsStore((state) => state.openDetail);
  const items = useMailsStore((state) => state.items);
  const close = () => navigate("/mail", { replace: true });

  useEffect(() => {
    if (mailId) void openDetail(mailId);
  }, [mailId, openDetail]);

  const summary: Partial<RecruitmentMail> = items.find((mail) => mail.id === mailId) ?? {};
  const message: Partial<RecruitmentMail> = detail?.message ?? (detail as Partial<RecruitmentMail>) ?? {};
  const subject = text(message.subject ?? summary.subject, "招聘邮件");

  return (
    <Dialog open onClose={close} labelledby="job-detail-title" kicker={`招聘邮件 · ${text(mailId, "邮件来源")}`} title={subject}>
      <div className="job-detail-content" data-state="ready">
        <div className="job-detail-meta mail-detail-meta">
          {[
            message.sender ?? summary.sender,
            mailDateTime(message.received_at ?? summary.received_at),
            mailProcessingLabel(detail?.processing_status ?? summary.processing_status),
          ]
            .filter(Boolean)
            .map((value, index) => (
              <span key={index} className="table-tag">{String(value)}</span>
            ))}
        </div>
        {detail === null ? <LoadingRows rows={3} /> : null}
        {message.company_candidates?.[0]?.value || summary.company_name || message.job_candidates?.[0]?.value || summary.job_title ? (
          <p className="mail-detail-target">
            {`投递目标：${[
              message.company_candidates?.[0]?.value ?? summary.company_name,
              message.job_candidates?.[0]?.value ?? summary.job_title,
            ]
              .filter(Boolean)
              .join(" · ")}`}
          </p>
        ) : null}
        <pre className="mail-detail-body">{text(message.body_text ?? summary.body_text, "邮件正文未提供。")}</pre>
        <div className="job-detail-actions">
          <Button variant="ghost" onClick={close}>
            打开招聘邮箱
          </Button>
        </div>
        {!Object.keys(message).length && detail !== null ? <EmptyState title="邮件详情为空" /> : null}
        {detail === undefined ? <ErrorState title="邮件详情加载失败" /> : null}
      </div>
    </Dialog>
  );
}
