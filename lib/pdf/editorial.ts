import type { jsPDF } from "jspdf";

/**
 * Editorial document chrome — shared palette + drawing helpers for the
 * jsPDF generators (invoices, rental agreements, safety waivers).
 *
 * Matches the product's design language (storefront, marketing,
 * dashboard): warm paper neutrals, ink-on-white with hairline rules,
 * serif display (jsPDF's core Times — no font embedding needed for
 * print documents), sans body. No filled color bands, no zebra
 * striping, no rounded pills — those were the generic-template tells.
 *
 * Accent color: the operator's explicitly-set brand primary, passed by
 * the API route. When the operator never customized their brand the
 * documents stay pure ink — neutral and timeless beats defaulting every
 * tenant's legal paperwork to a platform color.
 */

export type Rgb = [number, number, number];

export const PDF_INK: Rgb = [31, 28, 23];
export const PDF_MUTED: Rgb = [92, 86, 81];
export const PDF_FAINT: Rgb = [138, 132, 124];
export const PDF_HAIRLINE: Rgb = [228, 222, 211];
export const PDF_RULE: Rgb = [207, 199, 183];
export const PDF_SUCCESS: Rgb = [76, 107, 58];

/** Parse an operator brand color into RGB. Returns null for missing or
 *  malformed values so callers fall back to ink. */
export function parseBrandColor(hex: string | null | undefined): Rgb | null {
  if (!hex) return null;
  const short = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  const full = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (short) {
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16),
    ];
  }
  if (full) {
    return [parseInt(full[1], 16), parseInt(full[2], 16), parseInt(full[3], 16)];
  }
  return null;
}

/** Letterspaced uppercase label — the documents' eyebrow style. */
export function drawEyebrow(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options: { align?: "left" | "right"; color?: Rgb } = {}
) {
  const color = options.color ?? PDF_FAINT;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...color);
  doc.text(text.toUpperCase(), x, y, {
    align: options.align ?? "left",
    charSpace: 0.9,
  });
}

/** Document header: serif business name, eyebrow document label and
 *  meta lines on the right, double rule underneath. Returns the y
 *  cursor below the header. */
export function drawHeader(
  doc: jsPDF,
  opts: {
    businessName: string;
    docLabel: string;
    metaLines: string[];
    margin: number;
    accent?: Rgb | null;
    /** Operator logo as a base64 data URL (fetched server-side). When
     *  present it replaces the serif business-name wordmark; on any
     *  failure we fall back to the name so a logo is purely additive. */
    logoDataUrl?: string | null;
  }
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const { margin } = opts;
  const right = pageWidth - margin;

  let logoDrawn = false;
  if (opts.logoDataUrl) {
    try {
      const props = doc.getImageProperties(opts.logoDataUrl);
      const maxH = 38;
      const maxW = pageWidth * 0.42;
      let h = maxH;
      let w = (props.width / props.height) * h;
      if (w > maxW) {
        w = maxW;
        h = (props.height / props.width) * w;
      }
      doc.addImage(opts.logoDataUrl, (props.fileType || "PNG").toUpperCase(), margin, margin, w, h);
      logoDrawn = true;
    } catch {
      // Malformed/unsupported image — fall back to the name wordmark.
    }
  }

  if (!logoDrawn) {
    doc.setFont("times", "bold");
    doc.setFontSize(23);
    doc.setTextColor(...PDF_INK);
    doc.text(opts.businessName, margin, margin + 18, { maxWidth: pageWidth * 0.55 });
  }

  drawEyebrow(doc, opts.docLabel, right, margin + 6, {
    align: "right",
    color: opts.accent ?? PDF_INK,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_MUTED);
  let metaY = margin + 20;
  for (const line of opts.metaLines) {
    doc.text(line, right, metaY, { align: "right" });
    metaY += 13;
  }

  // Editorial double rule: one weighted ink line over a warm hairline.
  // Pushed down when the right column carries multiple meta lines.
  const ruleY = margin + 21 + Math.max(1, opts.metaLines.length) * 13;
  doc.setDrawColor(...PDF_INK);
  doc.setLineWidth(1.4);
  doc.line(margin, ruleY, right, ruleY);
  doc.setDrawColor(...PDF_HAIRLINE);
  doc.setLineWidth(0.6);
  doc.line(margin, ruleY + 3.5, right, ruleY + 3.5);
  doc.setLineWidth(0.6);

  return ruleY + 28;
}

/** Warm hairline rule across the content width. */
export function drawHairline(doc: jsPDF, x1: number, x2: number, y: number, color: Rgb = PDF_HAIRLINE) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.6);
  doc.line(x1, y, x2, y);
}

/** Centered muted footer line above the page bottom. */
export function drawFooter(doc: jsPDF, text: string, margin: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  drawHairline(doc, margin, pageWidth - margin, pageHeight - 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_FAINT);
  doc.text(text, pageWidth / 2, pageHeight - 30, { align: "center" });
}
