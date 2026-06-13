import { jsPDF } from "jspdf";
import {
  PDF_INK,
  PDF_MUTED,
  PDF_FAINT,
  PDF_RULE,
  drawEyebrow,
  drawHeader,
  drawHairline,
  drawFooter,
  parseBrandColor,
} from "@/lib/pdf/editorial";
import { resolveDocumentClauses } from "@/lib/documents/terms";

export type DocumentParty = {
  name: string;
  /** Pre-formatted address lines (street, then "City, ST 12345"). */
  addressLines: string[];
  phone: string;
  email: string;
};

export type DocumentLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type DocumentFinancials = {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  taxLabel: string | null;
  total: number;
  depositPaid: number;
  balanceDue: number;
};

export type DocumentPdfData = {
  documentType: "rental_agreement" | "safety_waiver";
  /** Lessor — the rental business. */
  business: DocumentParty & {
    /** Authorized representative who countersigns on the lessor's behalf.
     *  Null → the lessor signature line is left blank for wet ink. */
    representativeName: string | null;
  };
  /** Renter — the customer. */
  renter: DocumentParty;
  supportEmail: string;
  orderNumber: string;
  /** "March 1, 2026" for a single day, or "March 1 – March 3, 2026" when
   *  rental_end_date differs from the event date. */
  rentalPeriod: string;
  items: DocumentLineItem[];
  /** Money summary. Rendered on the rental agreement only (a waiver is not
   *  a financial document). Null when unavailable. */
  financials: DocumentFinancials | null;
  signedDate: string | null;
  signerName: string | null;
  signerIp: string | null;
  signatureDataUrl: string | null;
  businessType?: string;
  /** Operator-edited clauses (from document_templates). When present and
   *  non-empty, these REPLACE the built-in per-vertical defaults. */
  terms?: string[];
  /** Operator's explicitly-set brand primary (hex). Null/undefined →
   *  pure-ink document. */
  brandColor?: string | null;
  /** Operator logo as a base64 data URL; replaces the name wordmark in
   *  the header when present. */
  logoDataUrl?: string | null;
};

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatTitle(type: string): string {
  return type === "rental_agreement" ? "Rental Agreement" : "Safety Waiver";
}


/** Render one party's block (name + address lines + phone + email) in a
 *  column starting at (x, startY). Returns the y below the last line. */
function drawParty(
  doc: jsPDF,
  party: DocumentParty,
  x: number,
  startY: number,
  colWidth: number
): number {
  let y = startY;
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_INK);
  doc.setFont("helvetica", "bold");
  doc.text(party.name || "—", x, y, { maxWidth: colWidth });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_MUTED);
  for (const line of party.addressLines) {
    if (!line) continue;
    const wrapped = doc.splitTextToSize(line, colWidth) as string[];
    doc.text(wrapped, x, y);
    y += wrapped.length * 12;
  }
  if (party.phone) {
    doc.text(party.phone, x, y);
    y += 12;
  }
  if (party.email) {
    doc.text(party.email, x, y, { maxWidth: colWidth });
    y += 12;
  }
  return y;
}

export function generateDocumentPdf(data: DocumentPdfData): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  const colWidth = contentWidth / 2 - 12;
  const rightColX = margin + contentWidth / 2 + 12;
  const accent = parseBrandColor(data.brandColor);

  const title = formatTitle(data.documentType);
  // Operator-edited clauses win; otherwise the built-in per-vertical set.
  const terms = resolveDocumentClauses(
    data.terms,
    data.documentType,
    data.businessType ?? "inflatable",
  );
  const showFinancials =
    data.documentType === "rental_agreement" && data.financials !== null;

  // ─── Header ───────────────────────────────────────────────────────
  let y = drawHeader(doc, {
    businessName: data.business.name,
    docLabel: title,
    metaLines: [`Order #${data.orderNumber}`],
    margin,
    accent,
    logoDataUrl: data.logoDataUrl,
  });

  // ─── Parties — Lessor (business) and Renter (customer) ────────────
  drawEyebrow(doc, "Lessor", margin, y);
  drawEyebrow(doc, "Renter", rightColX, y);
  y += 14;

  const lessorEnd = drawParty(doc, data.business, margin, y, colWidth);
  const renterEnd = drawParty(doc, data.renter, rightColX, y, colWidth);
  y = Math.max(lessorEnd, renterEnd) + 14;

  // ─── Rental period + order ────────────────────────────────────────
  drawHairline(doc, margin, margin + contentWidth, y);
  y += 16;
  drawEyebrow(doc, "Rental period", margin, y);
  drawEyebrow(doc, "Order", rightColX, y);
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_INK);
  doc.setFont("helvetica", "bold");
  doc.text(data.rentalPeriod || "TBD", margin, y + 16, { maxWidth: colWidth });
  doc.text(`#${data.orderNumber}`, rightColX, y + 16);
  doc.setFont("helvetica", "normal");
  y += 30;
  drawHairline(doc, margin, margin + contentWidth, y);
  y += 24;

  // ─── Itemized equipment table ─────────────────────────────────────
  if (data.items.length > 0) {
    drawEyebrow(doc, "Equipment", margin, y);
    if (showFinancials) {
      drawEyebrow(doc, "Qty", margin + 320, y, { align: "right" });
      drawEyebrow(doc, "Unit", margin + 400, y, { align: "right" });
      drawEyebrow(doc, "Total", margin + contentWidth, y, { align: "right" });
    } else {
      drawEyebrow(doc, "Qty", margin + contentWidth, y, { align: "right" });
    }
    y += 8;
    doc.setDrawColor(...PDF_INK);
    doc.setLineWidth(0.9);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setLineWidth(0.6);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const item of data.items) {
      if (y + 24 > pageHeight - margin - 30) {
        doc.addPage();
        y = margin;
      }
      const nameLine = (doc.splitTextToSize(item.name, 290)[0] as string) ?? item.name;
      doc.setTextColor(...PDF_INK);
      doc.text(nameLine, margin, y + 16);
      if (showFinancials) {
        doc.setTextColor(...PDF_MUTED);
        doc.text(String(item.quantity), margin + 320, y + 16, { align: "right" });
        doc.text(formatMoney(item.unitPrice), margin + 400, y + 16, { align: "right" });
        doc.setTextColor(...PDF_INK);
        doc.text(formatMoney(item.lineTotal), margin + contentWidth, y + 16, { align: "right" });
      } else {
        doc.setTextColor(...PDF_MUTED);
        doc.text(`×${item.quantity}`, margin + contentWidth, y + 16, { align: "right" });
      }
      y += 24;
      drawHairline(doc, margin, margin + contentWidth, y);
    }

    // ─── Totals (rental agreement only) ─────────────────────────────
    if (showFinancials && data.financials) {
      const f = data.financials;
      const labelX = margin + contentWidth - 210;
      const amountX = margin + contentWidth;
      y += 16;
      doc.setFontSize(10);
      doc.setTextColor(...PDF_MUTED);
      doc.text("Subtotal", labelX, y);
      doc.text(formatMoney(f.subtotal), amountX, y, { align: "right" });
      if (f.deliveryFee > 0) {
        y += 16;
        doc.text("Delivery", labelX, y);
        doc.text(formatMoney(f.deliveryFee), amountX, y, { align: "right" });
      }
      if (f.tax > 0) {
        y += 16;
        doc.text(f.taxLabel ?? "Tax", labelX, y);
        doc.text(formatMoney(f.tax), amountX, y, { align: "right" });
      }
      y += 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...PDF_INK);
      doc.text("Total", labelX, y);
      doc.text(formatMoney(f.total), amountX, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...PDF_MUTED);
      if (f.depositPaid > 0) {
        y += 16;
        doc.text("Amount paid", labelX, y);
        doc.text(`- ${formatMoney(f.depositPaid)}`, amountX, y, { align: "right" });
      }
      y += 16;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_INK);
      doc.text("Balance due", labelX, y);
      doc.setTextColor(...(accent ?? PDF_INK));
      doc.text(formatMoney(f.balanceDue), amountX, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_INK);
    }

    y += 16;
    drawHairline(doc, margin, margin + contentWidth, y);
    y += 24;
  }

  // ─── Terms heading — serif display ────────────────────────────────
  if (y + 60 > pageHeight - 190) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(15);
  doc.setFont("times", "bold");
  doc.setTextColor(...PDF_INK);
  doc.text("Terms & Conditions", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");

  // ─── Terms paragraphs ─────────────────────────────────────────────
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_MUTED);

  for (const term of terms) {
    const lines = doc.splitTextToSize(term, contentWidth);
    const blockHeight = lines.length * 14 + 8;

    // New page if needed (leave room for signature section ~160pt)
    if (y + blockHeight > pageHeight - 190) {
      doc.addPage();
      y = margin;
      doc.setFontSize(9.5);
      doc.setTextColor(...PDF_MUTED);
    }

    doc.text(lines, margin, y);
    y += blockHeight;
  }

  // ─── Two-party signature block ────────────────────────────────────
  // Renter signs electronically (via the portal); the lessor's
  // authorized representative countersigns. Reserve enough room for both
  // columns incl. a drawn signature, else start a fresh page.
  const sigSectionHeight = 210;
  if (y + sigSectionHeight > pageHeight - margin - 30) {
    doc.addPage();
    y = margin;
  }

  y += 10;
  drawHairline(doc, margin, margin + contentWidth, y);
  y += 24;

  doc.setFontSize(13);
  doc.setFont("times", "bold");
  doc.setTextColor(...PDF_INK);
  doc.text("Signatures", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_MUTED);
  const legalText = data.signerName
    ? `By signing below, ${data.signerName} acknowledges having read and agreed to all terms of this ${title}. ` +
      `Electronic signatures are legally binding under the ESIGN Act and UETA.`
    : `Both parties agree to the terms of this ${title}. Electronic signatures are legally binding under the ESIGN Act and UETA.`;
  const legalLines = doc.splitTextToSize(legalText, contentWidth) as string[];
  doc.text(legalLines, margin, y);
  y += legalLines.length * 13 + 12;

  // Both columns share the same baseline so the signature lines align.
  const sigLineY = y + 56;

  // Renter column (left) — captured electronic signature when signed.
  if (data.signatureDataUrl) {
    try {
      doc.addImage(data.signatureDataUrl, "PNG", margin, sigLineY - 50, 180, 46);
    } catch {
      /* skip a malformed data URL */
    }
  }
  doc.setDrawColor(...(data.signerName ? PDF_INK : PDF_RULE));
  doc.setLineWidth(0.8);
  if (!data.signerName) doc.setLineDashPattern([3, 3], 0);
  doc.line(margin, sigLineY, margin + colWidth - 10, sigLineY);
  doc.setLineDashPattern([], 0);

  // Lessor column (right) — authorized representative countersignature
  // line. Left blank for wet ink when no representative name is set.
  doc.setDrawColor(...PDF_INK);
  doc.setLineWidth(0.8);
  doc.line(rightColX, sigLineY, rightColX + colWidth - 10, sigLineY);

  let metaY = sigLineY + 13;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_INK);
  doc.text(data.signerName || "Renter signature", margin, metaY);
  doc.text(
    data.business.representativeName || data.business.name || "Authorized representative",
    rightColX,
    metaY
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_FAINT);
  metaY += 12;
  drawEyebrow(doc, "Renter", margin, metaY);
  drawEyebrow(doc, `Authorized representative · ${data.business.name}`, rightColX, metaY);

  metaY += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_FAINT);
  if (data.signedDate) {
    doc.text(`Signed ${data.signedDate}`, margin, metaY);
    if (data.signerIp) {
      doc.text(`IP ${data.signerIp}`, margin, metaY + 11);
    }
  } else {
    doc.text("Awaiting renter signature", margin, metaY);
  }
  doc.text("Date: ____________________", rightColX, metaY);

  // ─── Footer ───────────────────────────────────────────────────────
  drawFooter(doc, `${data.business.name} · ${data.supportEmail}`, margin);

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
