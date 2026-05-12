import { jsPDF } from "jspdf";

export type DocumentPdfData = {
  documentType: "rental_agreement" | "safety_waiver";
  businessName: string;
  supportEmail: string;
  orderNumber: string;
  customerName: string;
  eventDate: string;
  items: string[];
  signedDate: string | null;
  signerName: string | null;
  signerIp: string | null;
  signatureDataUrl: string | null;
};

function formatTitle(type: string): string {
  return type === "rental_agreement" ? "Rental Agreement" : "Safety Waiver";
}

const RENTAL_AGREEMENT_TERMS = [
  "1. RENTAL PERIOD & RETURN: Equipment must be available for pickup at the agreed time. Rental period begins upon delivery and ends at pickup. Customer is responsible for the equipment until it is retrieved.",
  "2. DAMAGE & LIABILITY: Customer accepts full responsibility for all damage to the equipment during the rental period, including damage caused by misuse, weather, or negligence. Normal wear is excluded.",
  "3. PAYMENT: Full balance is due no later than the event date. Deposits are non-refundable. Cancellations within 72 hours of the event forfeit the full deposit.",
  "4. WEATHER POLICY: Equipment must not be used during severe weather including high winds, lightning, or heavy rain. Customer may reschedule once at no charge if weather conditions are dangerous.",
  "5. SUPERVISION: An adult 18+ must supervise the equipment at all times. The renter assumes all responsibility for safe use.",
  "6. CAPACITY & USE: Equipment must not exceed posted weight/capacity limits. No shoes, sharp objects, or food on equipment. Violating these rules may result in immediate removal with no refund.",
  "7. SETUP AREA: Customer is responsible for providing a clean, level, obstacle-free area with access to a dedicated electrical outlet within 100 feet. Any additional setup fees for inaccessible locations are the customer's responsibility.",
  "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the rented equipment.",
];

const SAFETY_WAIVER_TERMS = [
  "1. ASSUMPTION OF RISK: I understand that the use of rental equipment involves risks, including but not limited to falls, collisions, and entrapment. I voluntarily assume all such risks.",
  "2. RELEASE OF LIABILITY: In consideration for the use of this equipment, I, on behalf of myself and any minor children in my care, hereby release and discharge the rental company from any and all claims, demands, or causes of action arising from participation.",
  "3. SAFETY RULES: I agree to enforce all posted safety rules, including no shoes, no rough play, no food or drinks on equipment, and maintaining capacity limits at all times.",
  "4. ADULT SUPERVISION: I certify that a responsible adult (18+) will supervise the equipment and all participants at all times during the rental period.",
  "5. MEDICAL AUTHORIZATION: In the event of an emergency involving a minor, I authorize emergency medical treatment and accept financial responsibility for any costs incurred.",
  "6. PHOTO RELEASE: I grant permission for photos taken at the event to be used by the rental company for promotional purposes, unless I notify them in writing to the contrary.",
  "7. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have the authority to sign on behalf of all participants.",
];

export function generateDocumentPdf(data: DocumentPdfData): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const title = formatTitle(data.documentType);
  const terms =
    data.documentType === "rental_agreement"
      ? RENTAL_AGREEMENT_TERMS
      : SAFETY_WAIVER_TERMS;

  // ─── Header ───────────────────────────────────────────────────────
  doc.setFillColor(30, 93, 207);
  doc.rect(0, 0, pageWidth, 80, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName, margin, 50);

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(title.toUpperCase(), pageWidth - margin, 38, { align: "right" });
  doc.setFontSize(10);
  doc.text(`Order #${data.orderNumber}`, pageWidth - margin, 54, { align: "right" });

  y = 106;
  doc.setTextColor(16, 35, 63);

  // ─── Party info ───────────────────────────────────────────────────
  doc.setFillColor(244, 247, 251);
  doc.roundedRect(margin, y, contentWidth, 52, 6, 6, "F");

  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);
  doc.text("CUSTOMER", margin + 12, y + 16);
  doc.text("EVENT DATE", margin + 220, y + 16);
  doc.text("ORDER", margin + 380, y + 16);

  doc.setFontSize(11);
  doc.setTextColor(16, 35, 63);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, margin + 12, y + 36);
  doc.text(data.eventDate, margin + 220, y + 36);
  doc.text(`#${data.orderNumber}`, margin + 380, y + 36);
  doc.setFont("helvetica", "normal");

  y += 68;

  // Rental items
  if (data.items.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(85, 112, 143);
    doc.text("RENTAL ITEMS", margin, y);
    y += 14;
    doc.setFontSize(10);
    doc.setTextColor(16, 35, 63);
    doc.text(data.items.join(" · ") || "—", margin, y);
    y += 22;
  }

  // ─── Section divider ──────────────────────────────────────────────
  doc.setDrawColor(219, 230, 244);
  doc.line(margin, y, margin + contentWidth, y);
  y += 18;

  // ─── Terms heading ────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 35, 63);
  doc.text(`Terms & Conditions`, margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");

  // ─── Terms paragraphs ─────────────────────────────────────────────
  doc.setFontSize(9.5);
  doc.setTextColor(40, 56, 80);

  for (const term of terms) {
    const lines = doc.splitTextToSize(term, contentWidth);
    const blockHeight = lines.length * 14 + 8;

    // New page if needed (leave room for signature section ~160pt)
    if (y + blockHeight > pageHeight - 180) {
      doc.addPage();
      y = margin;
    }

    doc.text(lines, margin, y);
    y += blockHeight;
  }

  // ─── Signature section ────────────────────────────────────────────
  const sigSectionHeight = data.signatureDataUrl ? 160 : 110;
  if (y + sigSectionHeight > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }

  y += 10;
  doc.setDrawColor(219, 230, 244);
  doc.line(margin, y, margin + contentWidth, y);
  y += 18;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 35, 63);
  doc.text("Electronic Signature", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 112, 143);

  if (data.signerName && data.signedDate) {
    const legalText =
      `By signing below, ${data.signerName} acknowledges having read and agreed to all terms ` +
      `of this ${title}. This electronic signature is legally binding under the ESIGN Act and UETA.`;
    const legalLines = doc.splitTextToSize(legalText, contentWidth);
    doc.text(legalLines, margin, y);
    y += legalLines.length * 13 + 10;

    // Drawn signature image
    if (data.signatureDataUrl) {
      try {
        doc.addImage(data.signatureDataUrl, "PNG", margin, y, 200, 60);
        y += 70;
      } catch {
        // If image fails to embed, skip silently
      }
    }

    // Signature line
    doc.setDrawColor(16, 35, 63);
    doc.line(margin, y, margin + 220, y);
    y += 14;

    doc.setFontSize(10);
    doc.setTextColor(16, 35, 63);
    doc.setFont("helvetica", "bold");
    doc.text(data.signerName, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(85, 112, 143);
    doc.text(data.signedDate, margin + 240, y);
    if (data.signerIp) {
      doc.text(`IP: ${data.signerIp}`, margin + 240, y + 13);
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(85, 112, 143);
    doc.text("Awaiting customer signature.", margin, y);
    y += 24;

    doc.setDrawColor(85, 112, 143);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(margin, y, margin + 240, y);
    doc.setLineDashPattern([], 0);
    y += 12;
    doc.setFontSize(9);
    doc.text("Customer signature", margin, y);
  }

  // ─── Footer ───────────────────────────────────────────────────────
  const footerY = pageHeight - 32;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(85, 112, 143);
  doc.text(
    `${data.businessName} · ${data.supportEmail}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
