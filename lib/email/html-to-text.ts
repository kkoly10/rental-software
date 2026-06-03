/**
 * Best-effort HTML → plain text for the multipart `text` part of an
 * email. Modern inbox providers (Gmail, Outlook, Apple Mail) penalize
 * HTML-only mail — adding a parallel text body improves inbox
 * placement and is the accessibility default for screen readers /
 * text-only clients.
 *
 * Not a full HTML parser. The strategy:
 *   1. Drop script / style blocks entirely.
 *   2. Convert block-level tags to newlines so paragraphs survive.
 *   3. Preserve `<a href="X">label</a>` as "label (X)" so URLs stay
 *      clickable when the inbox renders the text part directly.
 *   4. Strip everything else and decode the handful of HTML entities
 *      we actually emit (&amp;, &lt;, &gt;, &quot;, &#39;, &nbsp;).
 *   5. Collapse runs of whitespace.
 *
 * Lives in its own module rather than inside send.ts so it can be
 * unit-tested without pulling in the Supabase / Resend module graph.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
      // If the visible label is the same as the URL, don't duplicate.
      return cleanLabel && cleanLabel !== href ? `${cleanLabel} (${href})` : href;
    })
    .replace(/<\/(p|div|h[1-6]|li|tr|article|section|header|footer)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
