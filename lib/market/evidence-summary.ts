/**
 * Pure evidence-ladder summarization (Phase 1, the locked rental
 * flow). No server-only import so it's unit-testable; the server
 * wrapper in evidence.ts fetches rows and calls this.
 */

export type EvidenceSet = {
  photoCount: number;
  noteCount: number;
  firstAt: string | null;
  lastAt: string | null;
};

export type BookingEvidenceSummary = {
  sellerHandoff: EvidenceSet;
  renterHandoff: EvidenceSet;
  sellerReturn: EvidenceSet;
  renterReturn: EvidenceSet;
  /** The blocking gate: a seller may not capture a deposit for damage
   *  without a pre-rental condition baseline (≥1 handoff photo). */
  sellerBaselinePresent: boolean;
};

export type EvidenceRow = {
  phase: "handoff" | "return";
  party: "seller" | "renter";
  photo_url: string | null;
  created_at: string;
};

function emptySet(): EvidenceSet {
  return { photoCount: 0, noteCount: 0, firstAt: null, lastAt: null };
}

function fold(set: EvidenceSet, row: EvidenceRow): void {
  if (row.photo_url) set.photoCount += 1;
  else set.noteCount += 1;
  if (!set.firstAt || row.created_at < set.firstAt) set.firstAt = row.created_at;
  if (!set.lastAt || row.created_at > set.lastAt) set.lastAt = row.created_at;
}

export function summarizeEvidenceRows(rows: EvidenceRow[]): BookingEvidenceSummary {
  const summary: BookingEvidenceSummary = {
    sellerHandoff: emptySet(),
    renterHandoff: emptySet(),
    sellerReturn: emptySet(),
    renterReturn: emptySet(),
    sellerBaselinePresent: false,
  };
  for (const row of rows) {
    if (row.phase === "handoff" && row.party === "seller") fold(summary.sellerHandoff, row);
    else if (row.phase === "handoff" && row.party === "renter") fold(summary.renterHandoff, row);
    else if (row.phase === "return" && row.party === "seller") fold(summary.sellerReturn, row);
    else if (row.phase === "return" && row.party === "renter") fold(summary.renterReturn, row);
  }
  summary.sellerBaselinePresent = summary.sellerHandoff.photoCount > 0;
  return summary;
}

/** Minimum seller before-photos required to hand off an item. */
export const SELLER_HANDOFF_MIN_PHOTOS = 2;
