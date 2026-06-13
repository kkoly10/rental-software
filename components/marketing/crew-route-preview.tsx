/**
 * A faithful, static render of the Crew Mobile route view for the
 * marketing "Drivers know exactly where to go" feature row — the real
 * product, not a stock photo. Phone-framed so it visually rhymes with
 * the customer-booking phone photo in the row above (customer books on
 * a phone ↔ crew runs the route on a phone).
 *
 * Seeded with representative sample data in English, matching the other
 * committed product shots (dashboard-calendar, storefront-*). Purely
 * presentational: no data fetching, no client JS.
 */

type PreviewStop = {
  seq: number;
  name: string;
  time: string;
  item: string;
  address: string;
  note?: string;
  state: "done" | "current" | "upcoming";
};

const STOPS: PreviewStop[] = [
  {
    seq: 1,
    name: "Garcia — backyard birthday",
    time: "9:00 AM",
    item: "Castle Bounce House",
    address: "418 Maple Ave",
    state: "done",
  },
  {
    seq: 2,
    name: "Patel — block party",
    time: "10:30 AM",
    item: "20×20 Frame Tent",
    address: "77 Linden Ct",
    note: "Gate code 4417 · set up on side lawn",
    state: "current",
  },
  {
    seq: 3,
    name: "Nguyen — school fair",
    time: "12:15 PM",
    item: "6 Tables · 48 Chairs",
    address: "1200 Oak Street",
    state: "upcoming",
  },
];

export function CrewRoutePreview() {
  return (
    <div className="mk-crew-device" role="img" aria-label="Crew Mobile route view showing a delivery route with three stops, the second stop in progress with a gate code">
      <div className="mk-crew-screen">
        {/* Topbar */}
        <div className="mk-crew-topbar">
          <span className="mk-crew-brand">Crew · Today</span>
          <span className="mk-crew-status">In progress</span>
        </div>

        {/* Stylized route map: pins joined by the driving line. */}
        <div className="mk-crew-map" aria-hidden="true">
          <svg viewBox="0 0 280 120" preserveAspectRatio="xMidYMid slice">
            <path
              d="M14 92 C 60 92, 64 40, 110 40 S 196 78, 232 30"
              fill="none"
              stroke="rgba(255,255,255,.85)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 9"
            />
            <g className="mk-crew-pin mk-crew-pin--done">
              <circle cx="14" cy="92" r="7" />
              <text x="14" y="95.5">✓</text>
            </g>
            <g className="mk-crew-pin mk-crew-pin--current">
              <circle cx="110" cy="40" r="9" />
              <text x="110" y="44">2</text>
            </g>
            <g className="mk-crew-pin">
              <circle cx="232" cy="30" r="7" />
              <text x="232" y="33.5">3</text>
            </g>
          </svg>
          <span className="mk-crew-map-cta">Open route in Maps →</span>
        </div>

        {/* Route head + progress */}
        <div className="mk-crew-routehead">
          <strong>North Loop — Saturday</strong>
          <div className="mk-crew-meta">Van 2 · Mia &amp; Theo · 6 stops</div>
          <div className="mk-crew-progress">
            <span className="mk-crew-segs">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={i < 2 ? "on" : ""} />
              ))}
            </span>
            <span className="mk-crew-progress-label">2 of 6 done</span>
          </div>
        </div>

        {/* Stop timeline */}
        <ol className="mk-crew-stops">
          {STOPS.map((stop) => (
            <li key={stop.seq} className={`mk-crew-stop mk-crew-stop--${stop.state}`}>
              <span className="mk-crew-stop-num">
                {stop.state === "done" ? "✓" : stop.seq}
              </span>
              <div className="mk-crew-stop-body">
                <div className="mk-crew-stop-head">
                  <strong>{stop.name}</strong>
                  <span className="mk-crew-stop-tag">Delivery</span>
                </div>
                <div className="mk-crew-stop-line">
                  {stop.time} · {stop.item}
                </div>
                <div className="mk-crew-stop-addr">
                  {stop.address}
                  {stop.state === "current" && (
                    <span className="mk-crew-nav">Navigate →</span>
                  )}
                </div>
                {stop.note && <div className="mk-crew-stop-note">{stop.note}</div>}
                {stop.state === "done" && (
                  <div className="mk-crew-stop-done">Delivered · photo + signature on file</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
