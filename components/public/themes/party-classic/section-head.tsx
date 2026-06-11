import Link from "next/link";

interface SectionHeadProps {
  kicker?: string;
  title: string;
  sub?: string;
  link?: { label: string; href: string };
  center?: boolean;
}

/**
 * Editorial section header — eyebrow + display H2, with an optional
 * right-aligned text link on desktop. Pass `center` for centered single
 * column heads (used on "How it works" and "FAQ" intro side).
 */
export function SectionHead({ kicker, title, sub, link, center = false }: SectionHeadProps) {
  return (
    <div className={`st-section-head${center ? " st-section-head--center" : ""}`}>
      <div>
        {kicker && <span className="st-eyebrow">{kicker}</span>}
        <h2 className="st-section-title">{title}</h2>
        {sub && <p className="st-section-sub">{sub}</p>}
      </div>
      {link && !center && (
        <Link href={link.href} className="st-text-link">
          {link.label}
        </Link>
      )}
    </div>
  );
}
