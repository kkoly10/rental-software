import "server-only";
import {
  summarizeEvidenceRows,
  SELLER_HANDOFF_MIN_PHOTOS,
  type BookingEvidenceSummary,
  type EvidenceRow,
} from "./evidence-summary";

export { SELLER_HANDOFF_MIN_PHOTOS };
export type { BookingEvidenceSummary, EvidenceSet } from "./evidence-summary";

/**
 * Evidence summary for a booking (Phase 1, the locked rental flow).
 * Used by the founder dispute card (evidence ladder + presumption
 * rules) and the deposit-capture guard. Reads with the admin client;
 * the folding logic lives in evidence-summary.ts (unit-tested).
 */
export async function getBookingEvidenceSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  bookingId: string,
): Promise<BookingEvidenceSummary> {
  const { data } = await admin
    .from("market_handoff_evidence")
    .select("phase, party, photo_url, created_at")
    .eq("booking_id", bookingId)
    .order("created_at");
  return summarizeEvidenceRows((data ?? []) as EvidenceRow[]);
}

/** Count of seller handoff photos already on a booking (admin read). */
export async function countSellerHandoffPhotos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  bookingId: string,
): Promise<number> {
  const { count } = await admin
    .from("market_handoff_evidence")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("phase", "handoff")
    .eq("party", "seller")
    .not("photo_url", "is", null);
  return count ?? 0;
}
