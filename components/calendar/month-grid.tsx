"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CalendarEvent } from "@/lib/data/calendar";

type Props = {
  year: number;
  month: number;
  events: CalendarEvent[];
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

export function MonthGrid({ year, month, events }: Props) {
  const router = useRouter();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? today.getDate()
      : -1;

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of events) {
    const day = parseInt(ev.date.slice(8, 10), 10);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  }

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  function nav(y: number, m: number) {
    router.push(`/dashboard/calendar?year=${y}&month=${m}`);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
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
          &larr; Prev
        </button>
        <h2 style={{ margin: 0 }}>
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => nav(nextMonth.y, nextMonth.m)}
        >
          Next &rarr;
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1,
          background: "var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        {DAY_NAMES.map((d) => (
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
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
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
                      ) : (
                        ev.label
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-soft)",
                        paddingLeft: 5,
                      }}
                    >
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
