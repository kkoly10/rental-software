import { jsPDF } from "jspdf";
import {
  PDF_INK,
  PDF_MUTED,
  PDF_FAINT,
  PDF_SUCCESS,
  drawEyebrow,
  drawHeader,
  drawHairline,
  drawFooter,
  parseBrandColor,
} from "@/lib/pdf/editorial";

export type InvoiceData = {
  businessName: string;
  supportEmail: string;
  phone: string;
  orderNumber: string;
  invoiceDate: string;
  eventDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  /** Sales/rental tax computed from the operator's tax_rules for
   *  the delivery jurisdiction. 0 when no rule matched. */
  tax: number;
  /** Label from the matched tax_rule ("Florida sales tax",
   *  "Miami-Dade surtax", etc.). Null when no rule matched. */
  taxLabel: string | null;
  total: number;
  depositPaid: number;
  balanceDue: number;
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

/**
 * Generates a professional PDF invoice and returns the raw bytes.
 * Uses jsPDF — works in Node.js / serverless (no browser required).
 */
export function generateInvoicePdf(data: InvoiceData): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  const accent = parseBrandColor(data.brandColor);

  // ─── Header ───────────────────────────────────────────────────────
  let y = drawHeader(doc, {
    businessName: data.businessName,
    docLabel: "Invoice",
    metaLines: [`#${data.orderNumber}`, data.invoiceDate],
    margin,
    accent,
    logoDataUrl: data.logoDataUrl,
  });

  // ─── From / To ────────────────────────────────────────────────────
  const colWidth = contentWidth / 2;

  drawEyebrow(doc, "From", margin, y);
  drawEyebrow(doc, "Bill to", margin + colWidth, y);

  y += 16;
  doc.setFontSize(10);
  doc.setTextColor(...PDF_INK);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName, margin, y);
  doc.text(data.customerName, margin + colWidth, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_MUTED);
  doc.text(data.supportEmail, margin, y);
  doc.text(data.customerEmail, margin + colWidth, y);

  y += 14;
  doc.text(data.phone, margin, y);
  if (data.customerPhone) {
    doc.text(data.customerPhone, margin + colWidth, y);
  }

  y += 14;
  if (data.deliveryAddress) {
    doc.setTextColor(...PDF_FAINT);
    doc.text(data.deliveryAddress, margin + colWidth, y);
  }

  y += 28;

  // ─── Event details — hairline band, no fill ───────────────────────
  drawHairline(doc, margin, margin + contentWidth, y);
  y += 16;
  drawEyebrow(doc, "Event date", margin, y);
  drawEyebrow(doc, "Order number", margin + 190, y);
  drawEyebrow(doc, "Status", margin + 380, y);

  doc.setFontSize(10);
  doc.setTextColor(...PDF_INK);
  doc.setFont("helvetica", "bold");
  doc.text(data.eventDate, margin, y + 15);
  doc.text(`#${data.orderNumber}`, margin + 190, y + 15);
  doc.text(data.balanceDue <= 0 ? "Paid" : "Balance Due", margin + 380, y + 15);

  doc.setFont("helvetica", "normal");
  y += 28;
  drawHairline(doc, margin, margin + contentWidth, y);
  y += 26;

  // ─── Line items table — eyebrow heads, hairline rows, no zebra ────
  drawEyebrow(doc, "Item", margin, y);
  drawEyebrow(doc, "Qty", margin + 320, y, { align: "right" });
  drawEyebrow(doc, "Unit price", margin + 400, y, { align: "right" });
  drawEyebrow(doc, "Total", margin + contentWidth, y, { align: "right" });

  y += 8;
  doc.setDrawColor(...PDF_INK);
  doc.setLineWidth(0.9);
  doc.line(margin, y, margin + contentWidth, y);
  doc.setLineWidth(0.6);

  y += 4;
  doc.setTextColor(...PDF_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Table rows
  const pageHeight = doc.internal.pageSize.getHeight();
  const drawRow = (name: string, qty: string, unit: string, total: string) => {
    if (y + 24 > pageHeight - margin - 30) {
      doc.addPage();
      y = margin;
    }
    // Clamp the name to the name column so it can't overrun the numeric columns.
    const nameLine = (doc.splitTextToSize(name, 290)[0] as string) ?? name;
    doc.setTextColor(...PDF_INK);
    doc.text(nameLine, margin, y + 16);
    doc.setTextColor(...PDF_MUTED);
    if (qty) doc.text(qty, margin + 320, y + 16, { align: "right" });
    if (unit) doc.text(unit, margin + 400, y + 16, { align: "right" });
    doc.setTextColor(...PDF_INK);
    doc.text(total, margin + contentWidth, y + 16, { align: "right" });
    y += 24;
    drawHairline(doc, margin, margin + contentWidth, y);
  };

  for (const item of data.items) {
    drawRow(
      item.name,
      String(item.quantity),
      formatMoney(item.unitPrice),
      formatMoney(item.lineTotal)
    );
  }

  if (data.deliveryFee > 0) {
    drawRow("Delivery Fee", "", "", formatMoney(data.deliveryFee));
  }

  y += 14;

  // ─── Totals ───────────────────────────────────────────────────────
  const totalsX = margin + contentWidth - 210;
  const amountX = margin + contentWidth;

  doc.setFontSize(10);
  doc.setTextColor(...PDF_MUTED);
  doc.text("Subtotal", totalsX, y);
  doc.text(formatMoney(data.subtotal), amountX, y, { align: "right" });

  y += 18;
  doc.text("Delivery", totalsX, y);
  doc.text(formatMoney(data.deliveryFee), amountX, y, { align: "right" });

  if (data.tax > 0) {
    y += 18;
    doc.text(data.taxLabel ?? "Tax", totalsX, y);
    doc.text(formatMoney(data.tax), amountX, y, { align: "right" });
  }

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_INK);
  doc.text("Total", totalsX, y);
  doc.text(formatMoney(data.total), amountX, y, { align: "right" });

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_MUTED);
  // `depositPaid` carries total payments received, not just the deposit —
  // label it accordingly so a fully-paid invoice doesn't call the full
  // amount a "deposit".
  doc.text("Amount Paid", totalsX, y);
  doc.setTextColor(...PDF_SUCCESS);
  doc.text(`- ${formatMoney(data.depositPaid)}`, amountX, y, { align: "right" });

  // Balance due — weighted rule + serif emphasis, brand accent when set.
  y += 14;
  doc.setDrawColor(...PDF_INK);
  doc.setLineWidth(1.2);
  doc.line(totalsX, y, amountX, y);
  doc.setLineWidth(0.6);

  y += 20;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_INK);
  doc.text("Balance Due", totalsX, y);
  doc.setTextColor(...(accent ?? PDF_INK));
  doc.text(formatMoney(data.balanceDue), amountX, y, { align: "right" });

  // ─── Footer ───────────────────────────────────────────────────────
  drawFooter(
    doc,
    `Thank you — ${data.businessName} · Questions? ${data.supportEmail}`,
    margin
  );

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
