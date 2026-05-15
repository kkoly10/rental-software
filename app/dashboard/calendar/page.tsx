import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getUpcomingBlocks } from "@/lib/availability/data";
import { getCalendarEvents } from "@/lib/data/calendar";
import { BlockDatesForm } from "@/components/availability/block-dates-form";
import { AvailabilityBlockCard } from "@/components/availability/availability-block-card";
import { MonthGrid } from "@/components/calendar/month-grid";
import { getMessages } from "@/lib/i18n/server";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const [events, blocks, m] = await Promise.all([
    getCalendarEvents(year, month),
    getUpcomingBlocks(30),
    getMessages(),
  ]);

  return (
    <DashboardShell
      title={m.dashboard.calendar.title}
      description={m.dashboard.calendar.description}
    >
      <div className="dashboard-grid">
        <section>
          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">{m.dashboard.calendar.kickerSchedule}</div>
                <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.calendar.sectionMonth}</h2>
              </div>
              <Link href="/dashboard/orders/new" className="primary-btn">
                {m.dashboard.calendar.newBooking}
              </Link>
            </div>

            <MonthGrid year={year} month={month} events={events} />
          </div>
        </section>

        <aside>
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="section-header">
              <div>
                <div className="kicker">{m.dashboard.calendar.kickerBlocks}</div>
                <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.calendar.sectionManualHold}</h2>
              </div>
            </div>
            <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              {m.dashboard.calendar.blockHint}
            </p>
            <BlockDatesForm />
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">{m.dashboard.calendar.kickerUpcoming}</div>
                <h2 style={{ margin: "6px 0 0" }}>
                  {m.dashboard.calendar.sectionBlocks} ({blocks.length})
                </h2>
              </div>
            </div>

            {blocks.length === 0 ? (
              <div className="muted">{m.dashboard.calendar.noBlocks}</div>
            ) : (
              <div className="list">
                {blocks.map((block) => (
                  <AvailabilityBlockCard key={block.id} block={block} />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
