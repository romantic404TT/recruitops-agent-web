import { useEffect, useState } from "react";
import { Button, ExternalButton, IconButton } from "@/components/ui/Button";
import { SectionHeading, MiniStat } from "@/components/ui/Section";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/States";
import { compactDate, text } from "@/lib/format";
import { useCompanySourcesStore } from "@/stores/companySources";
import { useCompaniesStore } from "@/stores/companies";
import type { CompanySourceRecord, CompanySourceStatus } from "@/types/companySource";

const STATUS_LABELS: Record<string, string> = {
  pending: "待抓取",
  running: "抓取中",
  complete: "已完成",
  partial: "部分完成",
  failed: "失败",
  unusable: "不可用",
};

function SourceDetailDialog({ record, onClose }: { record: CompanySourceRecord; onClose: () => void }) {
  const saveEntryUrl = useCompanySourcesStore((state) => state.saveEntryUrl);
  const retry = useCompanySourcesStore((state) => state.retry);
  const jobs = useCompanySourcesStore((state) => state.detailJobs);
  const [entryUrl, setEntryUrl] = useState(record.entry_url ?? "");
  const [message, setMessage] = useState("");

  return (
    <Dialog open onClose={onClose} labelledby="source-detail-title" kicker={`${record.company_name} · ${record.source}`} title={STATUS_LABELS[record.status] ?? record.status} closeLabel="关闭来源详情">
      <div className="job-detail-content" data-state="ready">
        <dl className="automation-detail-facts">
          <div className="automation-detail-fact"><dt>入口地址</dt><dd>{text(record.entry_url, "未提供")}</dd></div>
          <div className="automation-detail-fact"><dt>最终地址</dt><dd>{text(record.final_url, "尚无")}</dd></div>
          <div className="automation-detail-fact"><dt>抓取岗位数</dt><dd>{text(record.job_count, 0)}</dd></div>
          <div className="automation-detail-fact"><dt>待补全 JD</dt><dd>{text(record.jd_pending_count, 0)}</dd></div>
          <div className="automation-detail-fact"><dt>上次成功岗位数</dt><dd>{text(record.last_success_job_count, 0)}</dd></div>
          <div className="automation-detail-fact"><dt>分页完整</dt><dd>{record.pagination_complete ? "是" : "否"}</dd></div>
          <div className="automation-detail-fact"><dt>失败阶段</dt><dd>{text(record.failure_stage, "无")}</dd></div>
          <div className="automation-detail-fact"><dt>原因码</dt><dd>{text(record.reason_code, "无")}</dd></div>
          <div className="automation-detail-fact"><dt>最近更新</dt><dd>{compactDate(record.updated_at)}</dd></div>
        </dl>
        {record.reason ? (
          <section className="automation-detail-alert">
            <h3>说明</h3>
            <p>{record.reason}</p>
          </section>
        ) : null}
        <section className="job-detail-section">
          <h3>本次抓到的岗位</h3>
          {!jobs ? <LoadingRows rows={2} /> : null}
          {jobs && !jobs.items.length ? <EmptyState title="暂无岗位" detail="该来源本轮没有抓到岗位。" /> : null}
          {jobs?.items.length ? (
            <ul className="data-list">
              {jobs.items.map((job) => (
                <li key={String(job.id)} className="data-row">
                  <span className="row-title">{text(job.title)}</span>
                  <span className="row-time">{text(job.city, "地点待确认")}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <form
          className="schedule-editor-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage("");
            try {
              await saveEntryUrl(record.id, { entry_url: entryUrl.trim(), expected_updated_at: record.updated_at });
              setMessage("入口地址已更新，来源重新排队。");
            } catch (error) {
              setMessage(`更新失败：${(error as Error).message}`);
            }
          }}
        >
          <div className="schedule-editor-grid">
            <label className="schedule-editor-field--wide">
              校招入口地址
              <input type="url" maxLength={2048} required value={entryUrl} onChange={(event) => setEntryUrl(event.target.value)} />
            </label>
            {message ? <p className="configuration-inline-message">{message}</p> : null}
          </div>
          <div className="job-detail-actions">
            <Button variant="secondary" type="submit">保存入口地址</Button>
            <Button variant="ghost" onClick={() => void retry(record.id)}>重新抓取</Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

/** 数据接入（上游 #integrations-view + company-sources.js 注入的分区）。 */
export default function IntegrationsPage() {
  const companies = useCompaniesStore((state) => state.companies);
  const loadCompanies = useCompaniesStore((state) => state.load);
  const items = useCompanySourcesStore((state) => state.items);
  const total = useCompanySourcesStore((state) => state.total);
  const page = useCompanySourcesStore((state) => state.page);
  const pageSize = useCompanySourcesStore((state) => state.pageSize);
  const search = useCompanySourcesStore((state) => state.search);
  const statusFilter = useCompanySourcesStore((state) => state.statusFilter);
  const loading = useCompanySourcesStore((state) => state.loading);
  const error = useCompanySourcesStore((state) => state.error);
  const detail = useCompanySourcesStore((state) => state.detail);
  const load = useCompanySourcesStore((state) => state.load);
  const setSearch = useCompanySourcesStore((state) => state.setSearch);
  const setStatusFilter = useCompanySourcesStore((state) => state.setStatusFilter);
  const setPage = useCompanySourcesStore((state) => state.setPage);
  const closeDetail = useCompanySourcesStore((state) => state.closeDetail);
  const [debounced, setDebounced] = useState(search);

  useEffect(() => {
    if (!companies.length) void loadCompanies();
  }, [companies.length, loadCompanies]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debounced, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const connected = companies.filter((item) => item.integration_status === "connected").length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="view-panel is-visible" data-view-panel="integrations" aria-labelledby="integrations-heading">
      <SectionHeading
        eyebrow="系统维护"
        titleId="integrations-heading"
        title="数据接入"
        description="当前阶段提供接入状态观察位，正式配置变更仍需经过审批。"
        actions={<IconButton icon="refresh" label="刷新来源" title="刷新来源" onClick={() => void load()} />}
      />
      <div className="company-metrics" aria-label="公司来源摘要">
        <MiniStat label="已接入" value={connected} />
        <MiniStat label="待确认" value={companies.length - connected} />
        <MiniStat label="来源总数" value={total} />
      </div>

      <section className="workspace-section" id="company-sources-section" aria-labelledby="company-source-list-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">公司发现来源</p>
            <h3 id="company-source-list-heading">来源登记</h3>
          </div>
          <span className="muted-label">{loading ? "加载中" : error ? "加载失败" : `${total} 条`}</span>
        </div>
        <div className="company-browser-toolbar">
          <label className="search-field">
            <span className="sr-only">搜索来源</span>
            <input type="search" placeholder="搜索公司或来源" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            <span className="sr-only">状态</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CompanySourceStatus | "")}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).filter(([key]) => key !== "unusable").map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll" data-state={loading ? "loading" : "ready"}>
          {error ? <ErrorState title="来源列表加载失败" detail={error} /> : null}
          {!loading && !error && !items.length ? <EmptyState title="暂无来源记录" detail="公司发现任务运行后会写入这里。" /> : null}
          {items.length ? (
            <table className="data-table">
              <thead>
                <tr><th>公司</th><th>来源</th><th>状态</th><th>岗位数</th><th>最近尝试</th><th>操作</th></tr>
              </thead>
              <tbody>
                {items.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.company_name}</strong></td>
                    <td className="cell-muted">{record.source}</td>
                    <td>
                      <span className={`table-tag table-tag--${record.status === "complete" ? "success" : record.status === "failed" ? "error" : "muted"}`}>
                        {STATUS_LABELS[record.status] ?? record.status}
                      </span>
                    </td>
                    <td className="numeric-cell">{text(record.job_count, 0)}</td>
                    <td className="cell-muted">{compactDate(record.last_attempt_at, "尚未尝试")}</td>
                    <td>
                      <div className="job-table-action-group">
                        <Button variant="ghost" small onClick={() => void useCompanySourcesStore.getState().openDetail(record.id)}>
                          详情
                        </Button>
                        {record.entry_url ? <ExternalButton href={record.entry_url} title="打开入口地址" ariaLabel={`打开 ${record.company_name} 入口`} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <div className="pager">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span>{`第 ${page} / ${pages} 页 · 共 ${total} 条`}</span>
          <Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="company-list-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">当前配置快照</p>
            <h3 id="company-list-heading">公司列表</h3>
          </div>
          <span className="muted-label">{`${companies.length} 家`}</span>
        </div>
        <div className="company-list" data-state={companies.length ? "ready" : "loading"}>
          {!companies.length ? <LoadingRows rows={3} /> : null}
          {companies.slice(0, 80).map((company) => (
            <div key={company.id} className="company-row">
              <div className="company-row-main">
                <span className={`company-status-mark${company.integration_status === "connected" ? " is-connected" : ""}`} aria-hidden="true">
                  {company.integration_status === "connected" ? "✓" : "?"}
                </span>
                {company.campus_url ? (
                  <a className="company-name" href={company.campus_url} target="_blank" rel="noreferrer">{company.name}</a>
                ) : (
                  <strong className="company-name">{company.name}</strong>
                )}
                <span className="company-meta">
                  {`${text(company.integration_status)} · ${text(company.crawler_key, "无 crawler")}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {detail ? <SourceDetailDialog record={detail} onClose={closeDetail} /> : null}
    </section>
  );
}
