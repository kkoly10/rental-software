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
  businessType?: string;
  /** Operator's explicitly-set brand primary (hex). Null/undefined →
   *  pure-ink document. */
  brandColor?: string | null;
};

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

export function generateDocumentPdf(data: DocumentPdfData): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  const accent = parseBrandColor(data.brandColor);

  const title = formatTitle(data.documentType);
  const terms = getTerms(data.documentType, data.businessType ?? "inflatable");

  // ─── Header ───────────────────────────────────────────────────────
  let y = drawHeader(doc, {
    businessName: data.businessName,
    docLabel: title,
    metaLines: [`Order #${data.orderNumber}`],
    margin,
    accent,
  });

  // ─── Party info — eyebrow labels over ink values, no fill box ─────
  drawEyebrow(doc, "Customer", margin, y);
  drawEyebrow(doc, "Event date", margin + 230, y);
  drawEyebrow(doc, "Order", margin + 392, y);

  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_INK);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, margin, y + 16);
  doc.text(data.eventDate, margin + 230, y + 16);
  doc.text(`#${data.orderNumber}`, margin + 392, y + 16);
  doc.setFont("helvetica", "normal");

  y += 42;

  // Rental items
  if (data.items.length > 0) {
    drawEyebrow(doc, "Rental items", margin, y);
    y += 15;
    doc.setFontSize(10);
    doc.setTextColor(...PDF_INK);
    doc.text(data.items.join("  ·  ") || "—", margin, y, { maxWidth: contentWidth });
    y += 22;
  }

  drawHairline(doc, margin, margin + contentWidth, y);
  y += 26;

  // ─── Terms heading — serif display ────────────────────────────────
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

  // ─── Signature section ────────────────────────────────────────────
  const sigSectionHeight = data.signatureDataUrl ? 170 : 120;
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
  doc.text("Electronic Signature", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_MUTED);

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
    doc.setDrawColor(...PDF_INK);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + 220, y);
    y += 14;

    doc.setFontSize(10);
    doc.setTextColor(...PDF_INK);
    doc.setFont("helvetica", "bold");
    doc.text(data.signerName, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_FAINT);
    doc.text(data.signedDate, margin + 240, y);
    if (data.signerIp) {
      doc.text(`IP: ${data.signerIp}`, margin + 240, y + 13);
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...PDF_MUTED);
    doc.text("Awaiting customer signature.", margin, y);
    y += 26;

    doc.setDrawColor(...PDF_RULE);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(margin, y, margin + 240, y);
    doc.setLineDashPattern([], 0);
    y += 12;
    drawEyebrow(doc, "Customer signature", margin, y);
  }

  // ─── Footer ───────────────────────────────────────────────────────
  drawFooter(doc, `${data.businessName} · ${data.supportEmail}`, margin);

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
