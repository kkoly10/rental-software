const integrations = [
  {
    name: "Stripe",
    description: "Payments",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="#635BFF"><path d="M14.8 12.2c0-1 .8-1.4 2.2-1.4 2 0 4.4.6 6.4 1.7V7.1c-2.2-.8-4.3-1.2-6.4-1.2C13 5.9 10 8.2 10 12.4c0 6.6 9.1 5.5 9.1 8.4 0 1.2-1 1.6-2.5 1.6-2.2 0-5-.9-7.2-2.1v5.5c2.5 1 4.9 1.5 7.2 1.5 4.2 0 7.2-2.1 7.2-6.3-.1-7.1-9-5.8-9-8.8z"/></svg>`,
  },
  {
    name: "Supabase",
    description: "Database",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32"><path d="M18.2 28.4c-.6.8-1.9.3-1.9-.7V18h10.4c1.5 0 2.4 1.8 1.4 3l-10 10.4z" fill="#3ECF8E"/><path d="M18.2 28.4c-.6.8-1.9.3-1.9-.7V18h10.4c1.5 0 2.4 1.8 1.4 3l-10 10.4z" fill="url(#sb)" fill-opacity=".2"/><path d="M13.8 3.6c.6-.8 1.9-.3 1.9.7V14H5.4c-1.5 0-2.4-1.8-1.4-3L13.8 3.6z" fill="#3ECF8E"/><defs><linearGradient id="sb" x1="16.3" y1="20.2" x2="24.1" y2="25.2" gradientUnits="userSpaceOnUse"><stop stop-color="#249361"/><stop offset="1" stop-color="#3ECF8E"/></linearGradient></defs></svg>`,
  },
  {
    name: "Resend",
    description: "Emails",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#000"/><text x="16" y="21" text-anchor="middle" fill="white" font-family="system-ui" font-size="14" font-weight="700">R</text></svg>`,
  },
  {
    name: "Next.js",
    description: "Platform",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#000"/><path d="M22 23.3L12.7 11H11v10h1.3V12.8l8.2 11.3c.5-.3 1-.7 1.5-1.1v.3z" fill="url(#ng)"/><rect x="20" y="11" width="1.3" height="10" fill="url(#ng2)"/><defs><linearGradient id="ng" x1="18" y1="17.5" x2="22.5" y2="23.5" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><linearGradient id="ng2" x1="20.6" y1="11" x2="20.6" y2="19" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs></svg>`,
  },
  {
    name: "Vercel",
    description: "Hosting",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 6L28 26H4L16 6Z" fill="#000"/></svg>`,
  },
];

export function IntegrationsBar() {
  return (
    <section className="section integrations-section">
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="kicker">Powered by</div>
          <h2 style={{ margin: "8px 0 0" }}>
            Built on infrastructure you can trust
          </h2>
        </div>

        <div className="integrations-grid">
          {integrations.map((integration) => (
            <div key={integration.name} className="integration-item">
              <div dangerouslySetInnerHTML={{ __html: integration.svg }} />
              <div>
                <strong style={{ fontSize: 14 }}>{integration.name}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {integration.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
