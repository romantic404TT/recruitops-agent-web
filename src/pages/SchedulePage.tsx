import { useEffect, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button, IconButton } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/States";
import { SegmentedControl } from "@/components/ui/Pager";
import { UiIcon } from "@/components/ui/UiIcon";
import { SCHEDULE_DUE_GROUPS, SCHEDULE_STATUS_LABELS, SCHEDULE_TIME_KIND_LABELS } from "@/lib/labels";
import {
  localDate,
  safeScheduleHref,
  scheduleCalendarTimeLabel,
  scheduleDateKey,
  scheduleDateLabel,
  scheduleDueGroup,
  scheduleEventTitle,
  scheduleMonthKey,
  scheduleMonthStart,
  scheduleTimeLabel,
  text,
} from "@/lib/format";
import { useScheduleStore, type ScheduleStatusFilter, type ScheduleView } from "@/stores/schedule";
import type { ScheduleEvent } from "@/types/domain";

const today = localDate();

function ScheduleItem({ event }: { event: ScheduleEvent }) {
  const navigate = useNavigate();
  const changeStatus = useScheduleStore((state) => state.changeStatus);
  const status = (SCHEDULE_STATUS_LABELS[event.status] ? event.status : "pending") as "pending" | "completed" | "ignored";
  const dueGroup = scheduleDueGroup(event);
  const locationValue = text(event.location_or_link, "").trim();
  const href = safeScheduleHref(locationValue);
  const fromMail = event.source === "recruitment_mail_schedule" && event.source_ref;

  return (
    <article className={`schedule-item schedule-item--${status} schedule-item--${dueGroup}`}>
      <div className="schedule-item-timing">
        <span className="schedule-item-date">{scheduleDateLabel(event.event_date)}</span>
        <time className="schedule-event-time">{scheduleTimeLabel(event)}</time>
      </div>
      <div className="schedule-item-copy">
        <strong className="schedule-item-title">{scheduleEventTitle(event)}</strong>
        <div className="schedule-item-meta">
          {[
            event.event_type,
            event.company_name,
            event.job_title,
            SCHEDULE_TIME_KIND_LABELS[event.time_kind] ?? "",
          ]
            .filter(Boolean)
            .map((value, index) => (
              <span key={index} className="schedule-meta-tag">{value}</span>
            ))}
        </div>
        {event.note ? <p className="schedule-item-note">{event.note}</p> : null}
        {locationValue && !href ? <p className="schedule-item-location">{locationValue}</p> : null}
        <span className={`schedule-status-tag schedule-status-tag--${status}`} data-status={status}>
          {SCHEDULE_STATUS_LABELS[status]}
        </span>
      </div>
      <div className="schedule-item-actions">
        {status === "pending" ? (
          <>
            <IconButton icon="check" small label={`完成：${scheduleEventTitle(event)}`} title="完成" onClick={() => void changeStatus(event.id, "completed")} />
            <IconButton icon="ignore" small label={`忽略：${scheduleEventTitle(event)}`} title="忽略" onClick={() => void changeStatus(event.id, "ignored")} />
          </>
        ) : (
          <IconButton icon="restore" small label={`恢复：${scheduleEventTitle(event)}`} title="恢复" onClick={() => void changeStatus(event.id, "pending")} />
        )}
        <IconButton icon="edit" small label={`编辑：${scheduleEventTitle(event)}`} title="编辑" onClick={() => navigate(`/schedule/edit/${encodeURIComponent(event.id)}`)} />
        {fromMail ? (
          <IconButton icon="mail" small label={`查看来源邮件：${scheduleEventTitle(event)}`} title="查看来源邮件" onClick={() => navigate(`/mail/${encodeURIComponent(String(event.source_ref))}`)} />
        ) : null}
        {href ? (
          <a className="icon-button icon-button--small" href={href} target="_blank" rel="noreferrer" title="打开位置或链接" aria-label={`打开位置或链接：${scheduleEventTitle(event)}`}>
            <UiIcon name="external" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function Calendar({ events, undated }: { events: ScheduleEvent[]; undated: ScheduleEvent[] }) {
  const navigate = useNavigate();
  const month = useScheduleStore((state) => state.month);
  const setMonth = useScheduleStore((state) => state.setMonth);
  const setDateFilter = useScheduleStore((state) => state.setDateFilter);
  const setStatus = useScheduleStore((state) => state.setStatus);
  const start = scheduleMonthStart(month || today);
  const firstDayOffset = (start.getDay() + 6) % 7;
  const gridStart = new Date(start.getFullYear(), start.getMonth(), 1 - firstDayOffset);

  const shiftMonth = (delta: number) => {
    const next = new Date(start.getFullYear(), start.getMonth() + delta, 1);
    setMonth(scheduleMonthKey(next));
  };

  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const dateKey = scheduleDateKey(day);
    return {
      day,
      dateKey,
      outside: day.getMonth() !== start.getMonth(),
      isToday: dateKey === today,
      events: events.filter((event) => event.event_date === dateKey),
    };
  });

  return (
    <section className="workspace-section schedule-calendar-view" aria-label="日程月历">
      <div className="schedule-calendar-toolbar">
        <IconButton icon="chevron-left" small label="上个月" title="上个月" onClick={() => shiftMonth(-1)} />
        <h3 id="schedule-calendar-month">
          {start.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}
        </h3>
        <IconButton icon="chevron-right" small label="下个月" title="下个月" onClick={() => shiftMonth(1)} />
      </div>
      <div className="schedule-calendar-weekdays" aria-hidden="true">
        {["一", "二", "三", "四", "五", "六", "日"].map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="schedule-calendar-grid" data-state="ready">
        {cells.map((cell) => (
          <article
            key={cell.dateKey}
            className={`schedule-calendar-day${cell.outside ? " is-outside" : ""}${cell.isToday ? " is-today" : ""}`}
            data-date={cell.dateKey}
            aria-label={cell.dateKey}
            onClick={() => {
              setDateFilter(cell.dateKey);
              setStatus("all");
            }}
          >
            <div className="schedule-calendar-day-heading">
              <span className="schedule-calendar-day-number">{cell.day.getDate()}</span>
              {cell.isToday ? <span className="schedule-calendar-today">今天</span> : null}
            </div>
            {cell.events.map((event) => (
              <button
                key={event.id}
                type="button"
                className={`schedule-calendar-event schedule-calendar-event--${event.status}${event.time_kind === "deadline" ? " schedule-calendar-event--deadline" : ""}`}
                title={`编辑：${scheduleEventTitle(event)}`}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  navigate(`/schedule/edit/${encodeURIComponent(event.id)}`);
                }}
              >
                <span className="schedule-calendar-event-time">{scheduleCalendarTimeLabel(event)}</span>
                <span className="schedule-calendar-event-title">{scheduleEventTitle(event)}</span>
              </button>
            ))}
          </article>
        ))}
      </div>
      {undated.length ? (
        <section className="schedule-calendar-undated" aria-label="未定日期事项">
          <h4>未定日期</h4>
          {undated.map((event) => (
            <button key={event.id} type="button" className="schedule-undated-row" onClick={() => navigate(`/schedule/edit/${encodeURIComponent(event.id)}`)}>
              {scheduleEventTitle(event)}
            </button>
          ))}
        </section>
      ) : null}
    </section>
  );
}

/** 日程安排（上游 #schedule-view，待办/月历两个子视图）。 */
export default function SchedulePage() {
  const view = useScheduleStore((state) => state.view);
  const status = useScheduleStore((state) => state.status);
  const dateFilter = useScheduleStore((state) => state.dateFilter);
  const loading = useScheduleStore((state) => state.loading);
  const error = useScheduleStore((state) => state.error);
  const all = useScheduleStore((state) => state.all);
  const setView = useScheduleStore((state) => state.setView);
  const setStatus = useScheduleStore((state) => state.setStatus);
  const setDateFilter = useScheduleStore((state) => state.setDateFilter);
  const goToday = useScheduleStore((state) => state.goToday);
  const goAll = useScheduleStore((state) => state.goAll);
  const loadFull = useScheduleStore((state) => state.loadFull);
  const navigate = useNavigate();

  useEffect(() => {
    if (!all.length) void loadFull();
  }, [all.length, loadFull]);

  const filtered = useScheduleStore((state) => state.filtered)();
  const undated = useMemo(() => filtered.filter((event) => !event.event_date), [filtered]);
  const dated = useMemo(() => filtered.filter((event) => event.event_date), [filtered]);

  return (
    <section className="view-panel is-visible" data-view-panel="schedule" aria-labelledby="schedule-page-heading">
      <SectionHeading
        eyebrow="笔试、面试与截止"
        titleId="schedule-page-heading"
        title="日程安排"
        description="按日期集中查看投递后的后续安排。"
        actions={
          <Button variant="secondary" icon="plus" onClick={() => navigate("/schedule/new")}>
            添加日程
          </Button>
        }
      />
      <div className="schedule-toolbar">
        <SegmentedControl<ScheduleView>
          ariaLabel="日程视图"
          asTabs
          className="schedule-view-toggle"
          value={view}
          onChange={setView}
          options={[
            { value: "todo", label: "待办", icon: <UiIcon name="list" /> },
            { value: "calendar", label: "月历", icon: <UiIcon name="calendar" /> },
          ]}
        />
        <label htmlFor="schedule-status-filter">状态</label>
        <select id="schedule-status-filter" value={status} onChange={(event) => setStatus(event.target.value as ScheduleStatusFilter)}>
          <option value="pending">待处理</option>
          <option value="completed">已完成</option>
          <option value="ignored">已忽略</option>
          <option value="all">全部状态</option>
        </select>
        <label htmlFor="schedule-date-filter">查看日期</label>
        <input id="schedule-date-filter" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        <Button variant="ghost" onClick={goToday}>今天</Button>
        <Button variant="ghost" onClick={goAll}>全部</Button>
        <span className="muted-label">{loading ? "加载中" : `${filtered.length} 项`}</span>
      </div>

      {view === "todo" ? (
        <section className="workspace-section schedule-todo-view" data-state={loading ? "loading" : "ready"} aria-label="日程待办">
          {loading ? <LoadingRows rows={2} /> : null}
          {!loading && error ? <ErrorState title="日程加载失败" detail={error} /> : null}
          {!loading && !error && !dated.length ? (
            <EmptyState
              title={status === "pending" ? "暂无待办日程" : "没有符合条件的日程"}
              detail="可以添加一个新的求职安排，或调整状态筛选。"
            />
          ) : null}
          {!loading && !error
            ? SCHEDULE_DUE_GROUPS.map(({ key, label }) => {
                const grouped = dated.filter((event) => scheduleDueGroup(event) === key);
                if (!grouped.length) return null;
                return (
                  <section key={key} className={`schedule-group schedule-group--${key}`}>
                    <div className="schedule-group-heading">
                      <h3>{label}</h3>
                      <span className="muted-label">{`${grouped.length} 项`}</span>
                    </div>
                    <div className="schedule-group-list">
                      {grouped.map((event) => <ScheduleItem key={event.id} event={event} />)}
                    </div>
                  </section>
                );
              })
            : null}
        </section>
      ) : (
        <Calendar events={dated} undated={undated} />
      )}
      <Outlet />
    </section>
  );
}
