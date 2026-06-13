/**
 * Listing quality score (sprint §6) — a deterministic 0–100, computed
 * on read (like the pricing/deposit calculators), NO table. Pure logic
 * with no `server-only` import so `node --test` can exercise it.
 *
 * Loanables' postmortem: trust was the #1 abandonment driver and
 * conversion was ~0.5%. This score exists to surface only listings
 * likely to convert and to nudge sellers toward the few things that
 * actually move that needle — not to shame anyone. It NEVER blocks
 * publishing; a low score becomes a soft warning, never a gate.
 *
 * Every component scores something the seller actually controls.
 * Condition (enum, always set) and fulfillment (pickup default) are
 * intentionally NOT scored — they carry no real signal.
 */

/** Below this, publish still succeeds but we warn the seller. */
export const SCORE_LOW_THRESHOLD = 60;

/** The most photos a listing supports (matches the upload cap). */
export const LISTING_PHOTO_CAP = 6;

export type ListingScoreInput = {
  photoCount: number;
  title: string;
  description: string | null;
  hasWeekendPrice: boolean;
  hasWeeklyPrice: boolean;
  replacementValueCents: number | null;
  proofVideoPresent: boolean;
  /** Category demands a proof-of-function video (powered/electric). */
  proofRequired: boolean;
};

export type ScoreComponent = {
  key: string;
  label: string;
  earned: number;
  max: number;
  /** Concrete advice, present only when the component isn't maxed. */
  suggestion: string | null;
};

export type ListingScore = {
  score: number;
  components: ScoreComponent[];
  /** Top suggestions, biggest point gain first (max 3). */
  suggestions: string[];
};

function descriptionPoints(desc: string): number {
  const len = desc.trim().length;
  if (len === 0) return 0;
  if (len < 80) return 10;
  if (len < 250) return 16;
  return 20;
}

function titlePoints(title: string): number {
  const t = title.trim();
  if (t.length >= 20 && t.includes(" ")) return 10;
  if (t.length >= 10) return 6;
  return 3;
}

function photoPoints(count: number): number {
  if (count <= 0) return 0;
  if (count >= 4) return 35;
  return Math.round((35 * count) / 4); // 1→9, 2→18, 3→26
}

/**
 * Score a single listing. Components sum to a max of 100. Photos carry
 * the most weight (the strongest conversion lever) and scale with the
 * real photo count, which is why multi-photo upload is a prerequisite.
 */
export function scoreListing(input: ListingScoreInput): ListingScore {
  const components: ScoreComponent[] = [];

  const photos = photoPoints(input.photoCount);
  components.push({
    key: "photos",
    label: "Photos",
    earned: photos,
    max: 35,
    suggestion:
      photos < 35
        ? input.photoCount <= 0
          ? "Add photos — listings without a photo almost never get booked."
          : "Add more photos (4+) from different angles — the single biggest booking lever."
        : null,
  });

  const desc = descriptionPoints(input.description ?? "");
  components.push({
    key: "description",
    label: "Description",
    earned: desc,
    max: 20,
    suggestion:
      desc < 20
        ? "Write a fuller description — what's included, condition details, and pickup notes."
        : null,
  });

  const title = titlePoints(input.title);
  components.push({
    key: "title",
    label: "Title",
    earned: title,
    max: 10,
    suggestion:
      title < 10
        ? "Make the title more descriptive — brand, size, and the key spec renters search for."
        : null,
  });

  const proof = input.proofRequired
    ? input.proofVideoPresent
      ? 15
      : 0
    : input.proofVideoPresent
      ? 15
      : 9;
  components.push({
    key: "proof",
    label: "Proof-of-function video",
    earned: proof,
    max: 15,
    suggestion:
      proof < 15
        ? input.proofRequired
          ? "This category requires a proof-of-function video before it can publish."
          : "Add a short proof-of-function video showing the item working — it builds trust."
        : null,
  });

  const value = input.replacementValueCents && input.replacementValueCents > 0 ? 10 : 4;
  components.push({
    key: "replacement_value",
    label: "Replacement value",
    earned: value,
    max: 10,
    suggestion:
      value < 10
        ? "Set the item's replacement value so the deposit is sized accurately and fairly."
        : null,
  });

  const pricing = 4 + (input.hasWeekendPrice ? 3 : 0) + (input.hasWeeklyPrice ? 3 : 0);
  components.push({
    key: "pricing",
    label: "Pricing tiers",
    earned: pricing,
    max: 10,
    suggestion:
      pricing < 10
        ? "Add weekend and weekly rates — multi-day renters book the listings that price for them."
        : null,
  });

  const score = components.reduce((sum, c) => sum + c.earned, 0);

  const suggestions = components
    .filter((c) => c.suggestion && c.earned < c.max)
    .sort((a, b) => b.max - b.earned - (a.max - a.earned))
    .slice(0, 3)
    .map((c) => c.suggestion!) as string[];

  return { score, components, suggestions };
}
