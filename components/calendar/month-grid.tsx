"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CalendarEvent } from "@/lib/data/calendar";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

type Props = {
  year: number;
  month: number;
  events: CalendarEvent[];
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

// Sunday = 0 ... Saturday = 6.  US/CA/JP start weeks on Sunday; most
// other supported locales start on Monday.  Intl.Locale.weekInfo would
// give us this dynamically but isn't yet widely supported, so a small
// per-locale map keeps it predictable.
function getWeekStartDay(locale: string): number {
  const root = locale.toLowerCase().split("-")[0];
  if (root === "en") return 0; // Sunday (US default)
  return 1; // Monday (fr/es/pt and most others)
}

function getDayNames(locale: string): string[] {
  const weekStart = getWeekStartDay(locale);
  // 2024-01-07 is a Sunday; offset so day[0] is the locale's first day.
  const base = new Date(2024, 0, 7 + weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toLocaleDateString(locale, { weekday: "short" });
  });
}

function getMonthName(locale: string, monthOneBased: number): string {
  const d = new Date(2024, monthOneBased - 1, 1);
  return d.toLocaleDateString(locale, { month: "long" });
}

export function MonthGrid({ year, month, events }: Props) {
  const router = useRouter();
  const { locale, messages: m } = useI18n();
  // Day number (1-31) of the day whose full event list is currently expanded
  // inline, or null when no day is expanded. Replaces the previous static
  // "+N more" pill that couldn't be clicked through.
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? today.getDate()
      : -1;

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of events) {
    // ev.date is expected to be a YYYY-MM-DD string; a malformed value
    // like "2026-06" would silently produce parseInt(NaN) and bucket
    // events under a meaningless key. Guard explicitly and skip rather
    // than mis-bucketing.
    const day = parseInt(ev.date.slice(8, 10), 10);
    if (!Number.isFinite(day) || day < 1 || day > 31) continue;
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  }

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  function nav(y: number, m: number) {
    router.push(`/dashboard/calendar?year=${y}&month=${m}`);
  }

  const weekStart = getWeekStartDay(locale);
  // Shift firstDay so cells line up with the locale's week start.
  // (firstDay - weekStart + 7) % 7 maps Sun=0 → 0 (US) or → 6 (EU).
  const leadingBlanks = (firstDay - weekStart + 7) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className="ghost-btn"
          onClick={() => nav(prevMonth.y, prevMonth.m)}
        >
          &larr; {m.common.back}
        </button>
        <h2 style={{ margin: 0 }}>
          {getMonthName(locale, month)} {year}
        </h2>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => nav(nextMonth.y, nextMonth.m)}
        >
          {m.common.next} &rarr;
        </button>
      </div>

      <div
        className="calendar-month-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1,
          background: "var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        {getDayNames(locale).map((d) => (
          <div
            key={d}
            style={{
              background: "var(--surface-muted)",
              padding: "8px 4px",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-soft)",
            }}
          >
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          const dayEvents = day ? eventsByDay[day] ?? [] : [];
          const isToday = day === todayStr;

          return (
            <div
              key={i}
              style={{
                background: isToday
                  ? "rgba(30, 93, 207, 0.06)"
                  : "var(--surface)",
                minHeight: 90,
                padding: 6,
                position: "relative",
              }}
            >
              {day && (
                <>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? "var(--primary)" : "var(--text-soft)",
                      marginBottom: 4,
                    }}
                  >
                    {day}
                  </div>
                  {(() => {
                    const isExpanded = expandedDay === day;
                    const visible = isExpanded ? dayEvents : dayEvents.slice(0, 3);
                    return (
                      <>
                        {visible.map((ev) => (
                          <div
                            key={ev.id}
                            title={ev.label}
                            style={{
                              fontSize: 11,
                              padding: "2px 5px",
                              marginBottom: 2,
                              borderRadius: 4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              background:
                                ev.type === "block"
                                  ? "#fdeaea"
                                  : ev.tone === "success"
                                  ? "#eaf9f4"
                                  : ev.tone === "warning"
                                  ? "#fff4e5"
                                  : "#eef3fb",
                              color:
                                ev.type === "block"
                                  ? "#c33"
                                  : ev.tone === "success"
                                  ? "#188862"
                                  : ev.tone === "warning"
                                  ? "#a86a08"
                                  : "var(--text)",
                            }}
                          >
                            {ev.type === "order" ? (
                              <Link
                                href={`/dashboard/orders/${ev.id}`}
                                style={{
                                  color: "inherit",
                                  textDecoration: "none",
                                }}
                              >
                                {ev.label}
                              </Link>
                            ) : ev.type === "delivery" ? (
                              <Link
                                href={`/dashboard/deliveries/${ev.id.replace(
                                  /^route:/,
                                  ""
                                )}`}
                                style={{
                                  color: "inherit",
                                  textDecoration: "none",
                                }}
                              >
                                {ev.label}
                              </Link>
                            ) : (
                              ev.label
                            )}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setExpandedDay(isExpanded ? null : day)}
                            aria-expanded={isExpanded}
                            style={{
                              fontSize: 10,
                              color: "var(--text-soft)",
                              paddingLeft: 5,
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              textAlign: "left",
                              font: "inherit",
                            }}
                          >
                            {isExpanded
                              ? m.calendar.collapseEvents
                              : formatMessage(m.calendar.moreEvents, { count: dayEvents.length - 3 })}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
