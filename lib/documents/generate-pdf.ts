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
  /** Operator's explicitly-set brand primary (hex). Null/undefined →
   *  pure-ink document. */
  brandColor?: string | null;
};

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatTitle(type: string): string {
  return type === "rental_agreement" ? "Rental Agreement" : "Safety Waiver";
}

// ─── Rental Agreement terms by vertical ──────────────────────────────────────
//
// Generic event-rental terms covering tents, tables-and-chairs, and
// dance-floors. These verticals share enough operational shape
// (delivery + setup at a venue, rental period bracketed by an event,
// weather considerations) that one shared block reads cleanly.
// Inflatables keeps its own version because the safety / supervision
// language is materially different.

const EVENT_RENTAL_TERMS: string[] = [
  "1. RENTAL PERIOD & RETURN: Equipment is delivered and picked up at the agreed times. The rental period begins upon delivery and ends at pickup. Customer is responsible for the equipment until it is retrieved.",
  "2. DAMAGE & LIABILITY: Customer accepts full responsibility for all damage to the equipment during the rental period, including damage caused by misuse, weather, or negligence. Normal wear is excluded.",
  "3. PAYMENT: Full balance is due no later than the event date. Deposits are non-refundable. Cancellations within 72 hours of the event forfeit the full deposit.",
  "4. WEATHER POLICY: Setup may be postponed or canceled if severe weather (high winds, lightning, heavy rain) makes installation unsafe. Customer may reschedule once at no charge under these conditions.",
  "5. SETUP AREA: Customer is responsible for providing a clean, level, obstacle-free area suitable for installation, plus reasonable access for the delivery crew. Additional setup fees apply for inaccessible locations or relocations.",
  "6. SITE CONDITIONS: Customer is responsible for marking buried utilities, sprinkler lines, and irrigation before the crew arrives. The rental company is not liable for damage caused by undisclosed obstructions.",
  "7. PERMITS & APPROVALS: Customer is responsible for any permits, venue approvals, or HOA notifications required for the installation.",
  "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the rented equipment.",
];

const EVENT_SAFETY_WAIVER_TERMS: string[] = [
  "1. ASSUMPTION OF RISK: I understand that the use of rental equipment at an event involves risks, including those associated with weather, surface conditions, and crowd movement. I voluntarily assume all such risks.",
  "2. RELEASE OF LIABILITY: In consideration for the use of this equipment, I, on behalf of myself and my guests, hereby release and discharge the rental company from any and all claims, demands, or causes of action arising from participation.",
  "3. SUPERVISION: I certify that responsible adults will supervise the installation and venue during the rental period.",
  "4. PROPER USE: I agree to use the equipment only as intended (no climbing on tents or tables, no overloading capacities, no relocating during the event without rental company approval).",
  "5. ANCHORING & SAFETY: I acknowledge the rental company's setup decisions including anchoring methods, sandbags, and exclusion zones, and agree not to alter or remove them.",
  "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have the authority to sign on behalf of all participants.",
];

const RENTAL_AGREEMENT_TERMS: Record<string, string[]> = {
  tents: EVENT_RENTAL_TERMS,
  "tables-and-chairs": EVENT_RENTAL_TERMS,
  "dance-floors": EVENT_RENTAL_TERMS,
  inflatable: [
    "1. RENTAL PERIOD & RETURN: Equipment must be available for pickup at the agreed time. Rental period begins upon delivery and ends at pickup. Customer is responsible for the equipment until it is retrieved.",
    "2. DAMAGE & LIABILITY: Customer accepts full responsibility for all damage to the equipment during the rental period, including damage caused by misuse, weather, or negligence. Normal wear is excluded.",
    "3. PAYMENT: Full balance is due no later than the event date. Deposits are non-refundable. Cancellations within 72 hours of the event forfeit the full deposit.",
    "4. WEATHER POLICY: Equipment must not be used during severe weather including high winds, lightning, or heavy rain. Customer may reschedule once at no charge if weather conditions are dangerous.",
    "5. SUPERVISION: An adult 18+ must supervise the equipment at all times. The renter assumes all responsibility for safe use.",
    "6. CAPACITY & USE: Equipment must not exceed posted weight/capacity limits. No shoes, sharp objects, or food on equipment. Violating these rules may result in immediate removal with no refund.",
    "7. SETUP AREA: Customer is responsible for providing a clean, level, obstacle-free area with access to a dedicated electrical outlet within 100 feet. Any additional setup fees for inaccessible locations are the customer's responsibility.",
    "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the rented equipment.",
  ],
  car: [
    "1. RENTAL PERIOD & RETURN: The vehicle must be returned by the agreed return date and time. Late returns are subject to additional daily charges. Customer is responsible for the vehicle from pickup to return.",
    "2. AUTHORIZED DRIVERS: Only the named renter and any additional drivers listed at the time of booking are authorized to operate the vehicle. Unauthorized drivers void coverage.",
    "3. DAMAGE & LIABILITY: Customer accepts full financial responsibility for all damage to the vehicle during the rental period, including collision, vandalism, and theft. Customer should carry their own auto insurance or purchase the rental company's protection plan.",
    "4. FUEL POLICY: The vehicle must be returned with the same fuel level as at pickup. Refueling fees apply if returned with less fuel.",
    "5. TRAFFIC & VIOLATIONS: Customer is responsible for all traffic citations, tolls, and parking violations incurred during the rental period.",
    "6. PROHIBITED USE: The vehicle may not be used for: commercial purposes, off-road driving, towing, transporting hazardous materials, or any illegal activity.",
    "7. GEOGRAPHIC RESTRICTIONS: The vehicle may not be taken outside the agreed geographic area without prior written authorization.",
    "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company from any claims, damages, or liabilities arising from the customer's use of the vehicle.",
  ],
  equipment: [
    "1. RENTAL PERIOD & RETURN: Equipment must be returned by the agreed return date. Late returns are subject to additional rental charges. Customer is responsible for the equipment from delivery or pickup until return.",
    "2. DAMAGE & LIABILITY: Customer accepts full financial responsibility for all damage, loss, or theft of the equipment during the rental period. Normal wear is excluded.",
    "3. PAYMENT: Full balance is due at the start of the rental period. Deposits are non-refundable unless canceled within the allowed cancellation window.",
    "4. QUALIFIED OPERATORS: Customer certifies that all operators of the equipment are qualified and trained for its safe operation. Customer assumes full liability for misuse or operator error.",
    "5. PROHIBITED USE: Equipment may not be modified, sublet, or used outside the scope for which it was designed. Overloading or misuse voids all protections.",
    "6. MAINTENANCE & INSPECTION: Customer agrees to inspect the equipment upon receipt and report any pre-existing damage before use. Equipment must be returned in the same condition, ordinary wear excepted.",
    "7. COMPLIANCE: Customer agrees to comply with all applicable local, state, and federal safety regulations governing the use of the rented equipment.",
    "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the rented equipment.",
  ],
};

// ─── Safety Waiver terms by vertical ─────────────────────────────────────────

const SAFETY_WAIVER_TERMS: Record<string, string[]> = {
  tents: EVENT_SAFETY_WAIVER_TERMS,
  "tables-and-chairs": EVENT_SAFETY_WAIVER_TERMS,
  "dance-floors": EVENT_SAFETY_WAIVER_TERMS,
  inflatable: [
    "1. ASSUMPTION OF RISK: I understand that the use of rental equipment involves risks, including but not limited to falls, collisions, and entrapment. I voluntarily assume all such risks.",
    "2. RELEASE OF LIABILITY: In consideration for the use of this equipment, I, on behalf of myself and any minor children in my care, hereby release and discharge the rental company from any and all claims, demands, or causes of action arising from participation.",
    "3. SAFETY RULES: I agree to enforce all posted safety rules, including no shoes, no rough play, no food or drinks on equipment, and maintaining capacity limits at all times.",
    "4. ADULT SUPERVISION: I certify that a responsible adult (18+) will supervise the equipment and all participants at all times during the rental period.",
    "5. MEDICAL AUTHORIZATION: In the event of an emergency involving a minor, I authorize emergency medical treatment and accept financial responsibility for any costs incurred.",
    "6. PHOTO RELEASE: I grant permission for photos taken at the event to be used by the rental company for promotional purposes, unless I notify them in writing to the contrary.",
    "7. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have the authority to sign on behalf of all participants.",
  ],
  car: [
    "1. ASSUMPTION OF RISK: I understand that operating a motor vehicle involves inherent risks. I voluntarily assume all risks associated with driving the rental vehicle.",
    "2. DRIVER CERTIFICATION: I certify that I hold a valid driver's license appropriate for the class of vehicle rented and am legally permitted to drive in the jurisdiction where the vehicle will be operated.",
    "3. CONDITION ACKNOWLEDGMENT: I have inspected the vehicle and agree that any damage not noted on the vehicle condition report at pickup is my responsibility.",
    "4. INSURANCE REPRESENTATION: I represent that I carry adequate auto liability insurance or have purchased the rental company's protection plan for the duration of this rental.",
    "5. COMPLIANCE: I agree to operate the vehicle in compliance with all applicable traffic laws and regulations.",
    "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age.",
  ],
  equipment: [
    "1. ASSUMPTION OF RISK: I understand that the operation of heavy or powered equipment involves inherent risks, including mechanical failure, operator error, and environmental hazards. I voluntarily assume all such risks.",
    "2. OPERATOR COMPETENCY: I certify that I (and any operators I designate) am trained and competent in the safe operation of the rented equipment and hold any required licenses or certifications.",
    "3. SAFETY COMPLIANCE: I agree to follow all applicable OSHA regulations, manufacturer guidelines, and site safety requirements during use of the equipment.",
    "4. PRE-USE INSPECTION: I agree to inspect the equipment before each use and immediately report any defects, damage, or unsafe conditions to the rental company.",
    "5. RELEASE OF LIABILITY: I hereby release and discharge the rental company from any and all claims arising from my use or misuse of the equipment, to the extent permitted by law.",
    "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have the authority to sign on behalf of my organization.",
  ],
};

function getTerms(
  documentType: "rental_agreement" | "safety_waiver",
  businessType: string
): string[] {
  const map = documentType === "rental_agreement" ? RENTAL_AGREEMENT_TERMS : SAFETY_WAIVER_TERMS;
  // Unknown business types fall through to the generic event-rental
  // block — previously they got the inflatable terms which mention
  // bouncers and "no shoes" rules, which would read as oddly specific
  // for, say, a hardware-equipment operator that landed on the
  // wrong key. The event-rental block reads cleanly across every
  // delivery-driven vertical.
  const fallback = documentType === "rental_agreement"
    ? EVENT_RENTAL_TERMS
    : EVENT_SAFETY_WAIVER_TERMS;
  return map[businessType] ?? fallback;
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
  const terms = getTerms(data.documentType, data.businessType ?? "inflatable");
  const showFinancials =
    data.documentType === "rental_agreement" && data.financials !== null;

  // ─── Header ───────────────────────────────────────────────────────
  let y = drawHeader(doc, {
    businessName: data.business.name,
    docLabel: title,
    metaLines: [`Order #${data.orderNumber}`],
    margin,
    accent,
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
