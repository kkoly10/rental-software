import { getMessages } from "@/lib/i18n/server";

const trustVisuals = [
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    bg: "#edf4ff",
    color: "#1e5dcf",
  },
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    bg: "#eaf9f4",
    color: "#188862",
  },
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    bg: "#fff4e5",
    color: "#a86a08",
  },
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    bg: "#f5f0ff",
    color: "#7c3aed",
  },
] as const;

const shieldSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

interface TrustBarProps {
  customBadges?: { title: string; description: string }[];
}

export async function TrustBar({ customBadges }: TrustBarProps) {
  const useCustom = customBadges && customBadges.length > 0;
  const m = await getMessages();
  const defaultItems = m.storefront.trust.defaults.map((d, i) => ({
    ...d,
    ...trustVisuals[i],
  }));

  return (
    <section className="trust-bar-section">
      <div className="container">
        <div className="trust-items">
          {useCustom
            ? customBadges.map((badge) => (
                <div key={badge.title} className="trust-item">
                  <div
                    className="trust-icon"
                    style={{ background: "#edf4ff", color: "#1e5dcf" }}
                    dangerouslySetInnerHTML={{ __html: shieldSvg }}
                  />
                  <div className="trust-item-text">
                    <strong>{badge.title}</strong>
                    <span>{badge.description}</span>
                  </div>
                </div>
              ))
            : defaultItems.map((item) => (
                <div key={item.title} className="trust-item">
                  <div
                    className="trust-icon"
                    style={{ background: item.bg, color: item.color }}
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                  <div className="trust-item-text">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
