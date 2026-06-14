import { jsPDF } from "jspdf";
import type { PullSheetData } from "./pull-sheet";

/**
 * Generates a printable pull sheet PDF for a delivery route. The pull
 * sheet has two main sections:
 *
 *   1. **Load totals** at the top — aggregated item counts across all
 *      delivery stops on the route. The crew loads from this list before
 *      leaving the warehouse: "12 tables, 88 chairs, 1 bounce house."
 *
 *   2. **Per-stop breakdown** — each stop's customer, address, time
 *      window, and the items destined for that stop. Used at the
 *      delivery site to confirm what to drop off.
 *
 * Pickup stops are intentionally excluded — they're picked up at the end
 * of the day, not loaded at the start.
 */
export function generatePullSheetPdf(data: PullSheetData): Uint8Array {
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
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PULL SHEET", margin, 44);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(data.routeName, margin, 64);

  doc.setFontSize(10);
  doc.text(data.routeDate, pageWidth - margin, 44, { align: "right" });
  doc.text(`Driver: ${data.driverName}`, pageWidth - margin, 58, { align: "right" });
  doc.text(`Vehicle: ${data.vehicleName}`, pageWidth - margin, 72, { align: "right" });

  y = 110;
  doc.setTextColor(16, 35, 63);

  // ─── Empty-state guard ────────────────────────────────────────────
  if (data.stops.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(85, 112, 143);
    doc.text(
      "No delivery stops on this route. Add stops from the route detail page.",
      margin,
      y
    );
    return doc.output("arraybuffer") as unknown as Uint8Array;
  }

  // ─── Load totals ──────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 35, 63);
  doc.text("Load totals", margin, y);
  y += 8;

  doc.setFillColor(244, 247, 251);
  doc.roundedRect(margin, y, contentWidth, 28 + data.aggregated.length * 22, 6, 6, "F");
  y += 16;

  // Header row inside totals box
  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);
  doc.setFont("helvetica", "bold");
  doc.text("ITEM", margin + 12, y);
  doc.text("QTY", margin + contentWidth - 80, y, { align: "right" });
  doc.text("STOPS", margin + contentWidth - 12, y, { align: "right" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(16, 35, 63);
  doc.setFontSize(11);
  for (const item of data.aggregated) {
    // Defensive: keep load-totals on the first page; if we somehow run
    // off the page, break early — per-stop section will paginate
    // properly on its own.
    if (y + 22 > pageHeight - margin) break;
    const nameLine = (doc.splitTextToSize(item.name, contentWidth - 180)[0] as string) ?? item.name;
    doc.text(nameLine, margin + 12, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(String(item.totalQuantity), margin + contentWidth - 80, y + 4, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(85, 112, 143);
    doc.text(`${item.stopCount}`, margin + contentWidth - 12, y + 4, { align: "right" });
    doc.setTextColor(16, 35, 63);
    y += 22;
  }

  y += 16;

  // ─── Per-stop breakdown ───────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Stop-by-stop", margin, y);
  y += 16;

  for (const stop of data.stops) {
    const stopHeight = 56 + stop.items.length * 16 + 16;
    if (y + stopHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    // Stop card background
    doc.setFillColor(249, 251, 254);
    doc.roundedRect(margin, y, contentWidth, stopHeight - 8, 6, 6, "F");

    // Stop number + customer
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 93, 207);
    doc.text(`#${stop.sequence}`, margin + 12, y + 18);
    doc.setTextColor(16, 35, 63);
    const nameLine =
      (doc.splitTextToSize(stop.customerName || stop.orderNumber, contentWidth - 200)[0] as string) ??
      stop.customerName;
    doc.text(nameLine, margin + 44, y + 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(85, 112, 143);
    doc.text(stop.scheduledTime, pageWidth - margin - 12, y + 18, { align: "right" });

    // Address + phone
    if (stop.address) {
      const addrLine =
        (doc.splitTextToSize(stop.address, contentWidth - 30)[0] as string) ?? stop.address;
      doc.text(addrLine, margin + 12, y + 34);
    }
    if (stop.customerPhone) {
      doc.text(stop.customerPhone, pageWidth - margin - 12, y + 34, { align: "right" });
    }

    // Items checklist
    let itemY = y + 52;
    doc.setFontSize(10);
    doc.setTextColor(16, 35, 63);
    for (const item of stop.items) {
      // Checkbox
      doc.setDrawColor(120, 144, 178);
      doc.rect(margin + 14, itemY - 9, 10, 10, "S");
      // Item text
      const lineWithQty = `${item.name}  ×  ${item.quantity}`;
      const itemLine =
        (doc.splitTextToSize(lineWithQty, contentWidth - 40)[0] as string) ?? lineWithQty;
      doc.text(itemLine, margin + 30, itemY);
      itemY += 16;
    }

    y += stopHeight;
  }

  // ─── Footer ───────────────────────────────────────────────────────
  const footerY = pageHeight - 30;
  doc.setFontSize(8);
  doc.setTextColor(120, 144, 178);
  doc.text(
    `Generated ${new Date().toLocaleDateString(data.locale)} · ${data.organizationName}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
