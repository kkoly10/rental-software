export default function CrewTodayPage() {
  return (
    <main className="page">
      <div className="container">
        <div className="mobile-frame">
          <div className="mobile-screen">
            <div className="kicker">Crew mobile</div>
            <h1 style={{ margin: "6px 0 8px", fontSize: "1.6rem" }}>Today's Stops</h1>
            <div className="list">
              <div className="mobile-card">
                <strong>Johnson Birthday</strong>
                <div className="muted">9:00 AM · Stafford</div>
                <div className="muted">Castle Bouncer delivery</div>
              </div>
              <div className="mobile-card">Navigate to stop</div>
              <div className="mobile-card">Call customer</div>
              <div className="mobile-card">Checklist: blower, tarp, stakes, cord</div>
              <div className="mobile-card">Mark arrived, upload photo, collect signature</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
