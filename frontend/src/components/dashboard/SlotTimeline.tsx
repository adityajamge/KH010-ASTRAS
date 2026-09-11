import { useEffect, useMemo, useState } from "react";
import { fmtQty, fmtTime } from "../../lib/format";
import { useLanguage } from "../../lib/i18n";

export interface TimelineSlot {
  id: number;
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
  quantity: number;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "pending",
  scheduled: "scheduled",
  in_progress: "active",
  completed: "completed",
  cancelled: "cancelled",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function statusClass(status: string): string {
  return STATUS_CLASS[status] ?? "pending";
}

/** "06:00:00" -> 6.95 (hours as a float, for positioning on the axis). */
function timeToHours(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h + (m ?? 0) / 60 + (s ?? 0) / 3600;
}

function hourLabel(hour: number): string {
  const h = Math.round(hour) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

function todayLocalISO(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ticks every 60 seconds so a live "now" marker can move without a page reload. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function groupSchedulesByDate<T extends { date: string }>(
  rows: T[],
): { date: string; slots: T[] }[] {
  const byDate = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.date);
    if (bucket) bucket.push(row);
    else byDate.set(row.date, [row]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({ date, slots }));
}

/**
 * A single day's allocated water slots plotted on a time axis — replaces the
 * old fixed decorative marker with bars positioned/sized from real start,
 * end and quantity data, plus a live "now" line when the date is today.
 */
export function SlotTimeline({
  date,
  slots,
  now,
}: {
  date: string;
  slots: TimelineSlot[];
  now: Date;
}) {
  const { t } = useLanguage();
  const [activeId, setActiveId] = useState<number | null>(null);

  const { startHour, endHour, ticks } = useMemo(() => {
    const starts = slots.map((s) => timeToHours(s.start_time));
    const ends = slots.map((s) => timeToHours(s.end_time));
    const minStart = Math.floor(Math.min(6, ...starts));
    const maxEnd = Math.max(minStart + 2, Math.ceil(Math.max(...ends)));
    const span = maxEnd - minStart;
    const step = span <= 4 ? 1 : span <= 8 ? 2 : 4;
    const tickHours: number[] = [];
    for (let h = minStart; h <= maxEnd; h += step) tickHours.push(h);
    return { startHour: minStart, endHour: maxEnd, ticks: tickHours };
  }, [slots]);

  const span = endHour - startHour;
  const pct = (hour: number) => ((hour - startHour) / span) * 100;

  const isToday = date === todayLocalISO(now);
  const nowHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const showNow = isToday && nowHour >= startHour && nowHour <= endHour;

  const distinctStatuses = [...new Set(slots.map((s) => s.status))];
  const active = slots.find((s) => s.id === activeId) ?? null;

  return (
    <div className="slot-chart">
      <div className="slot-chart-axis">
        {ticks.map((h) => (
          <span key={h} className="slot-chart-tick" style={{ left: `${pct(h)}%` }}>
            {hourLabel(h)}
          </span>
        ))}
      </div>
      <div className="slot-chart-track">
        {ticks.map((h) => (
          <span
            key={h}
            className="slot-chart-grid"
            aria-hidden="true"
            style={{ left: `${pct(h)}%` }}
          />
        ))}
        {slots.map((slot) => {
          const left = pct(timeToHours(slot.start_time));
          const width = Math.max(pct(timeToHours(slot.end_time)) - left, 3);
          const labelFits = width >= 14;
          return (
            <div
              key={slot.id}
              className={`slot-chart-bar slot-chart-bar--${statusClass(slot.status)}${
                activeId === slot.id ? " is-active" : ""
              }`}
              // 1px inset on each side is the surface-color gap that keeps
              // back-to-back slots (e.g. two sequential requests on one
              // date) visually distinct instead of reading as one bar.
              style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)` }}
              tabIndex={0}
              role="img"
              aria-label={`${fmtQty(slot.quantity)} ${t("units")}, ${fmtTime(slot.start_time)} ${t(
                "to",
              )} ${fmtTime(slot.end_time)}, ${t(statusLabel(slot.status))}`}
              onMouseEnter={() => setActiveId(slot.id)}
              onMouseLeave={() => setActiveId((id) => (id === slot.id ? null : id))}
              onFocus={() => setActiveId(slot.id)}
              onBlur={() => setActiveId((id) => (id === slot.id ? null : id))}
            >
              {labelFits && (
                <span className="slot-chart-bar-label">{fmtQty(slot.quantity)}</span>
              )}
            </div>
          );
        })}
        {showNow && (
          <div className="slot-chart-now" style={{ left: `${pct(nowHour)}%` }}>
            <span className="slot-chart-now-dot" />
          </div>
        )}
        {active && (
          <div
            className="slot-chart-tooltip"
            style={{ left: `${Math.min(Math.max(pct(timeToHours(active.start_time)), 8), 92)}%` }}
          >
            <strong>
              {fmtQty(active.quantity)} {t("units")}
            </strong>
            <span>
              {fmtTime(active.start_time)}–{fmtTime(active.end_time)}
            </span>
            <span>{t(statusLabel(active.status))}</span>
          </div>
        )}
      </div>
      {distinctStatuses.length > 1 && (
        <div className="slot-chart-legend">
          {distinctStatuses.map((status) => (
            <span key={status} className="slot-chart-legend-item">
              <span className={`slot-chart-legend-dot slot-chart-bar--${statusClass(status)}`} />
              {t(statusLabel(status))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
