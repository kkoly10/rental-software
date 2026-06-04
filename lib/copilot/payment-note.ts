// Marker stamped onto every payment the Copilot records, so the payment row
// itself (visible in the Payments view and the accounting CSV export) shows it
// was added through the AI Operator Copilot. Who recorded it and exactly when
// live on the payment row (recording user + paid_at/created_at) and in the
// audit log; this is the human-readable attribution that travels with the note.
export const COPILOT_PAYMENT_MARKER = "Added via Operator Copilot";

// Must stay within recordPaymentSchema's reference-note limit.
const REFERENCE_NOTE_MAX = 120;

/**
 * Build the reference note stored for a Copilot-recorded payment: always the
 * attribution marker, optionally followed by the operator's own note, capped
 * to the column limit. The marker is preserved even when the combined note
 * has to be truncated, so attribution is never lost.
 */
export function buildCopilotPaymentReferenceNote(operatorNote?: string): string {
  const note = operatorNote?.trim();
  if (!note) return COPILOT_PAYMENT_MARKER;

  const combined = `${COPILOT_PAYMENT_MARKER} — ${note}`;
  if (combined.length <= REFERENCE_NOTE_MAX) return combined;

  return combined.slice(0, REFERENCE_NOTE_MAX).trimEnd();
}
