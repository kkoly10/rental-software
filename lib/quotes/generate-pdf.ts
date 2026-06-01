import { jsPDF } from "jspdf";

export type QuotePdfData = {
  businessName: string;
  supportEmail: string;
  phone: string;
  orderNumber: string;
  quoteDate: string;
  eventDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  depositRequired: number;
  portalUrl: string;
};

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function generateQuotePdf(data: QuotePdfData): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ─── Header ───────────────────────────────────────────────────────
  doc.setFillColor(30, 93, 207);
  doc.rect(0, 0, pageWidth, 80, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName, margin, 50);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("QUOTE", pageWidth - margin, 36, { align: "right" });
  doc.setFontSize(10);
  doc.text(`#${data.orderNumber}`, pageWidth - margin, 52, { align: "right" });
  doc.text(data.quoteDate, pageWidth - margin, 66, { align: "right" });

  y = 110;
  doc.setTextColor(16, 35, 63);

  // ─── From / To ────────────────────────────────────────────────────
  const colWidth = contentWidth / 2;

  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);
  doc.text("FROM", margin, y);
  doc.text("PREPARED FOR", margin + colWidth, y);

  y += 16;
  doc.setFontSize(10);
  doc.setTextColor(16, 35, 63);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName, margin, y);
  doc.text(data.customerName, margin + colWidth, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(data.supportEmail, margin, y);
  doc.text(data.customerEmail, margin + colWidth, y);

  y += 14;
  doc.text(data.phone, margin, y);
  if (data.customerPhone) {
    doc.text(data.customerPhone, margin + colWidth, y);
  }

  y += 14;
  if (data.deliveryAddress) {
    doc.setTextColor(85, 112, 143);
    doc.text(data.deliveryAddress, margin + colWidth, y);
  }

  y += 30;

  // ─── Event details ────────────────────────────────────────────────
  doc.setFillColor(244, 247, 251);
  doc.roundedRect(margin, y, contentWidth, 36, 6, 6, "F");

  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);
  doc.text("Event Date", margin + 12, y + 14);
  doc.text("Quote Number", margin + 180, y + 14);
  doc.text("Status", margin + 360, y + 14);

  doc.setFontSize(10);
  doc.setTextColor(16, 35, 63);
  doc.setFont("helvetica", "bold");
  doc.text(data.eventDate, margin + 12, y + 28);
  doc.text(`#${data.orderNumber}`, margin + 180, y + 28);
  doc.text("Pending Acceptance", margin + 360, y + 28);
  doc.setFont("helvetica", "normal");
  y += 54;

  // ─── Line items table ─────────────────────────────────────────────
  doc.setFillColor(30, 93, 207);
  doc.rect(margin, y, contentWidth, 26, "F");

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Item", margin + 12, y + 17);
  doc.text("Qty", margin + 320, y + 17, { align: "right" });
  doc.text("Unit Price", margin + 400, y + 17, { align: "right" });
  doc.text("Total", margin + contentWidth - 12, y + 17, { align: "right" });

  y += 26;
  doc.setTextColor(16, 35, 63);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (y + 24 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    if (i % 2 === 0) {
      doc.setFillColor(249, 251, 254);
      doc.rect(margin, y, contentWidth, 24, "F");
    }
    // Append "…" when the name overflows the column so the truncation
    // is visible to the recipient rather than silently dropping the tail.
    const split = doc.splitTextToSize(item.name, 290) as string[];
    const firstLine = split[0] ?? item.name;
    const nameLine = split.length > 1 || firstLine.length < item.name.length
      ? firstLine.replace(/\s*\S{0,3}$/, "") + "…"
      : firstLine;
    doc.text(nameLine, margin + 12, y + 16);
    doc.text(String(item.quantity), margin + 320, y + 16, { align: "right" });
    doc.text(formatMoney(item.unitPrice), margin + 400, y + 16, { align: "right" });
    doc.text(formatMoney(item.lineTotal), margin + contentWidth - 12, y + 16, { align: "right" });
    y += 24;
  }

  if (data.deliveryFee > 0) {
    doc.setFillColor(249, 251, 254);
    doc.rect(margin, y, contentWidth, 24, "F");
    doc.text("Delivery Fee", margin + 12, y + 16);
    doc.text(formatMoney(data.deliveryFee), margin + contentWidth - 12, y + 16, { align: "right" });
    y += 24;
  }

  y += 8;

  // ─── Totals ───────────────────────────────────────────────────────
  const totalsX = margin + contentWidth - 200;

  doc.setDrawColor(219, 230, 244);
  doc.line(totalsX, y, margin + contentWidth, y);
  y += 18;

  doc.setFontSize(10);
  doc.setTextColor(85, 112, 143);
  doc.text("Subtotal", totalsX, y);
  doc.text(formatMoney(data.subtotal), margin + contentWidth - 12, y, { align: "right" });

  y += 18;
  doc.text("Delivery", totalsX, y);
  doc.text(formatMoney(data.deliveryFee), margin + contentWidth - 12, y, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 35, 63);
  doc.text("Total", totalsX, y);
  doc.text(formatMoney(data.total), margin + contentWidth - 12, y, { align: "right" });

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(85, 112, 143);
  doc.text("Deposit to confirm", totalsX, y);
  doc.setTextColor(30, 93, 207);
  doc.text(formatMoney(data.depositRequired), margin + contentWidth - 12, y, { align: "right" });

  // ─── Accept CTA ───────────────────────────────────────────────────
  y += 36;
  if (y + 80 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(244, 247, 251);
  doc.roundedRect(margin, y, contentWidth, 68, 8, 8, "F");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 35, 63);
  doc.text("Ready to book?", margin + 16, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(85, 112, 143);
  const ctaText = `Accept this quote and pay your deposit online at:`;
  doc.text(ctaText, margin + 16, y + 38);
  doc.setTextColor(30, 93, 207);
  doc.text(data.portalUrl, margin + 16, y + 52);

  // ─── Footer ───────────────────────────────────────────────────────
  const footerY = pageHeight - 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);
  doc.text(
    `Thank you for considering ${data.businessName}! Questions? ${data.supportEmail}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
