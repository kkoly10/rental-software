"use client";

import { useState } from "react";
import type { PortalOrder } from "@/lib/portal/lookup";

export function InvoiceDownload({ order }: { order: PortalOrder }) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(30, 93, 207);
      doc.text("INVOICE", pageWidth / 2, 28, { align: "center" });

      // Order info
      doc.setFontSize(11);
      doc.setTextColor(85, 112, 143);
      doc.text(`Order #${order.orderNumber}`, 20, 44);
      doc.text(`Event Date: ${order.eventDate}`, 20, 52);
      doc.text(`Status: ${order.status}`, 20, 60);
      doc.text(`Customer: ${order.customerName}`, 20, 68);

      // Divider
      doc.setDrawColor(219, 230, 244);
      doc.line(20, 74, pageWidth - 20, 74);

      // Items header
      doc.setFontSize(12);
      doc.setTextColor(16, 35, 63);
      doc.text("Rental Items", 20, 86);

      doc.setFontSize(10);
      doc.setTextColor(85, 112, 143);
      let y = 96;
      if (order.items.length === 0) {
        doc.text("No items listed", 24, y);
        y += 10;
      } else {
        order.items.forEach((item) => {
          doc.text(`- ${item}`, 24, y);
          y += 8;
        });
      }

      y += 6;
      doc.setDrawColor(219, 230, 244);
      doc.line(20, y, pageWidth - 20, y);
      y += 14;

      // Pricing
      doc.setFontSize(11);
      const priceX = pageWidth - 30;

      doc.setTextColor(85, 112, 143);
      doc.text("Subtotal", 24, y);
      doc.text(order.subtotal, priceX, y, { align: "right" });
      y += 10;

      doc.text("Delivery Fee", 24, y);
      doc.text(order.deliveryFee, priceX, y, { align: "right" });
      y += 10;

      doc.setDrawColor(219, 230, 244);
      doc.line(20, y, pageWidth - 20, y);
      y += 10;

      doc.setFontSize(12);
      doc.setTextColor(16, 35, 63);
      doc.text("Total", 24, y);
      doc.text(order.total, priceX, y, { align: "right" });
      y += 12;

      doc.setFontSize(10);
      doc.setTextColor(85, 112, 143);
      doc.text("Deposit Due", 24, y);
      doc.text(order.depositDue, priceX, y, { align: "right" });
      y += 10;

      doc.setFontSize(12);
      doc.setTextColor(30, 93, 207);
      doc.text("Balance Due", 24, y);
      doc.text(order.balanceDue, priceX, y, { align: "right" });

      // Footer
      y += 24;
      doc.setFontSize(9);
      doc.setTextColor(170, 170, 170);
      doc.text("Thank you for your business!", pageWidth / 2, y, { align: "center" });

      doc.save(`Invoice-${order.orderNumber}.pdf`);
    } catch {
      alert("Unable to generate invoice. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      type="button"
      className="portal-invoice-btn"
      onClick={handleDownload}
      disabled={generating}
    >
      {generating ? "Generating..." : "Download Invoice"}
    </button>
  );
}
