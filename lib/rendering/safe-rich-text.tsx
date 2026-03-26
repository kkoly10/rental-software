import type { ReactNode } from "react";

function isSafeHref(href: string) {
  return href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://");
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(<strong key={`${keyPrefix}-bold-${match.index}`}>{match[2]}</strong>);
    } else if (match[4] && match[5]) {
      const href = match[5].trim();
      if (isSafeHref(href)) {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            href={href}
            style={{ color: "var(--primary)" }}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
          >
            {match[4]}
          </a>
        );
      } else {
        nodes.push(match[4]);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function renderSafeRichText(text: string) {
  return text.split("\n").map((line, index, lines) => (
    <span key={`line-${index}`}>
      {renderInline(line, `line-${index}`)}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
}
