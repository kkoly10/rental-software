import { jsPDF } from "jspdf";

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
  total: number;
  depositPaid: number;
  balanceDue: number;
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
  doc.text("INVOICE", pageWidth - margin, 36, { align: "right" });
  doc.setFontSize(10);
  doc.text(`#${data.orderNumber}`, pageWidth - margin, 52, { align: "right" });
  doc.text(data.invoiceDate, pageWidth - margin, 66, { align: "right" });

  y = 110;
  doc.setTextColor(16, 35, 63);

  // ─── From / To ────────────────────────────────────────────────────
  const colWidth = contentWidth / 2;

  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);
  doc.text("FROM", margin, y);
  doc.text("BILL TO", margin + colWidth, y);

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
  doc.text("Order Number", margin + 180, y + 14);
  doc.text("Status", margin + 360, y + 14);

  doc.setFontSize(10);
  doc.setTextColor(16, 35, 63);
  doc.setFont("helvetica", "bold");
  doc.text(data.eventDate, margin + 12, y + 28);
  doc.text(`#${data.orderNumber}`, margin + 180, y + 28);
  doc.text(data.balanceDue <= 0 ? "Paid" : "Balance Due", margin + 360, y + 28);

  doc.setFont("helvetica", "normal");
  y += 54;

  // ─── Line items table ─────────────────────────────────────────────
  // Table header
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

  // Table rows
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (i % 2 === 0) {
      doc.setFillColor(249, 251, 254);
      doc.rect(margin, y, contentWidth, 24, "F");
    }

    doc.text(item.name, margin + 12, y + 16);
    doc.text(String(item.quantity), margin + 320, y + 16, { align: "right" });
    doc.text(formatMoney(item.unitPrice), margin + 400, y + 16, { align: "right" });
    doc.text(formatMoney(item.lineTotal), margin + contentWidth - 12, y + 16, { align: "right" });
    y += 24;
  }

  // Delivery fee row
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
  doc.text("Deposit Paid", totalsX, y);
  doc.setTextColor(24, 136, 98);
  doc.text(`- ${formatMoney(data.depositPaid)}`, margin + contentWidth - 12, y, { align: "right" });

  y += 22;
  doc.setFillColor(30, 93, 207);
  doc.roundedRect(totalsX - 8, y - 14, 208, 30, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Balance Due", totalsX, y + 4);
  doc.text(formatMoney(data.balanceDue), margin + contentWidth - 12, y + 4, { align: "right" });

  // ─── Footer ───────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);
  doc.text(
    `Thank you for choosing ${data.businessName}! Questions? ${data.supportEmail}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  doc.text(
    "Powered by RentalOS",
    pageWidth / 2,
    footerY + 14,
    { align: "center" }
  );

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
