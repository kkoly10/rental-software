import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getUpcomingBlocks } from "@/lib/availability/data";
import { getCalendarEvents } from "@/lib/data/calendar";
import { BlockDatesForm } from "@/components/availability/block-dates-form";
import { AvailabilityBlockCard } from "@/components/availability/availability-block-card";
import { MonthGrid } from "@/components/calendar/month-grid";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const [events, blocks] = await Promise.all([
    getCalendarEvents(year, month),
    getUpcomingBlocks(30),
  ]);

  return (
    <DashboardShell
      title="Calendar"
      description="View bookings, deliveries, availability blocks, and upcoming event activity."
    >
      <div className="dashboard-grid">
        <section>
          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Schedule view</div>
                <h2 style={{ margin: "6px 0 0" }}>Month calendar</h2>
              </div>
              <Link href="/dashboard/orders/new" className="primary-btn">
                New booking
              </Link>
            </div>

            <MonthGrid year={year} month={month} events={events} />
          </div>
        </section>

        <aside>
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="section-header">
              <div>
                <div className="kicker">Block dates</div>
                <h2 style={{ margin: "6px 0 0" }}>Manual hold</h2>
              </div>
            </div>
            <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              Block a product for maintenance, private events, or any reason.
            </p>
            <BlockDatesForm />
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Next 30 days</div>
                <h2 style={{ margin: "6px 0 0" }}>
                  Availability blocks ({blocks.length})
                </h2>
              </div>
            </div>

            {blocks.length === 0 ? (
              <div className="muted">No blocked dates in the next 30 days.</div>
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
