/**
 * Sprint 6.0 — Render the operator/crew-facing item line for an
 * inflatable rental, including the mode badge and the "Bring:" anchor
 * spec. Pulled into its own module so the same friendly formatting
 * appears identically on the operator order detail page, the printable
 * pull sheet, and the crew today card — with locale-correct labels.
 *
 * The data loaders (order-detail, pull-sheet, route-detail) call this
 * via getMessages() so the strings respect the request locale.
 *
 * Why a helper instead of inlining: three independent surfaces each
 * had a copy of the same join + concat logic in earlier slices. One
 * helper means one place to tweak how anchoring methods get plural-
 * counted or how the mode badge is bracketed.
 */
import type { Messages } from "../i18n/messages/en";

type AnchoringKey =
  | "stakes"
  | "sandbags"
  | "water_barrels"
  | "concrete_weights"
  | "tie_downs";

export type InflatableItemMeta = {
  itemName: string;
  selectedMode?: string | null;
  anchoringMethods?: string[] | null;
  requiredAnchorCount?: number | null;
};

export function formatInflatableItemLine(
  item: InflatableItemMeta,
  labels: Messages["forms"]["editProduct"]["inflatableSetup"],
  bringPrefix: string,
): string {
  const parts = [item.itemName];

  if (item.selectedMode === "wet" || item.selectedMode === "dry") {
    const modeLabel =
      item.selectedMode === "wet" ? labels.wetLabel : labels.dryLabel;
    parts.push(`(${modeLabel})`);
  }

  const anchors = (item.anchoringMethods ?? []).filter(
    (a): a is AnchoringKey =>
      a === "stakes" ||
      a === "sandbags" ||
      a === "water_barrels" ||
      a === "concrete_weights" ||
      a === "tie_downs",
  );
  if (anchors.length > 0) {
    const friendly = anchors
      .map((key) => labels.anchoringMethodLabels[key])
      .join(", ");
    const count = item.requiredAnchorCount;
    parts.push(
      count != null && count > 0
        ? `- ${bringPrefix} ${friendly} ×${count}`
        : `- ${bringPrefix} ${friendly}`,
    );
  }

  return parts.join(" ");
}
