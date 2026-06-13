"use client";

import { useI18n } from "@/lib/i18n/provider";

/**
 * Customer "Download invoice" action. Links to the token-authed server
 * route (/api/portal/invoice), which renders the SAME professional,
 * branded, itemized invoice as the operator side via
 * lib/invoices/generate-pdf — replacing the old hand-rolled client PDF
 * that showed bare item names, the platform's blue, and no tax.
 */
export function InvoiceDownload({ portalToken }: { portalToken: string }) {
  const { messages: m } = useI18n();
  if (!portalToken) return null;

  return (
    <a
      className="portal-invoice-btn"
      href={`/api/portal/invoice?token=${encodeURIComponent(portalToken)}`}
      target="_blank"
      rel="noreferrer"
    >
      {m.portal.invoice.download}
    </a>
  );
}
