import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { categories, getCategory } from "@/lib/market/registry";

/**
 * Background category fixer: listings whose stored world/category no
 * longer matches the code registry (DB drift, renames) get served with
 * conservative fallback defaults (see registry/index.ts) until this
 * job re-files them. Runs from the hourly marketplace cron when
 * ANTHROPIC_API_KEY is configured; otherwise it's a no-op.
 *
 * Haiku 4.5: this is closed-set classification over ~60 labels — the
 * cheapest model is the right one ($1/M in, $5/M out; a run of 10
 * listings costs a fraction of a cent). The answer is validated
 * against the registry before any write, so a bad pick can never
 * introduce a new invalid slug.
 */

export function hasAnthropicEnv(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = "claude-haiku-4-5";

type Suggestion = { worldSlug: string; categorySlug: string } | null;

async function suggestCategory(
  client: Anthropic,
  listing: { title: string; description: string | null; world_slug: string },
): Promise<Suggestion> {
  const options = categories.map(
    (c) => `${c.worldSlug}/${c.slug} — ${c.label}`,
  );
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      "You classify rental-marketplace listings into a fixed category list. " +
      'Reply with ONLY the chosen identifier in the exact form "world-slug/category-slug" — no other text.',
    messages: [
      {
        role: "user",
        content:
          `Listing title: ${listing.title}\n` +
          `Description: ${listing.description ?? "(none)"}\n` +
          `Previously filed under world: ${listing.world_slug}\n\n` +
          `Valid categories:\n${options.join("\n")}\n\n` +
          "Pick the single best category for this listing.",
      },
    ],
  });
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const match = text.match(/([a-z0-9-]+)\/([a-z0-9-]+)/);
  if (!match) return null;
  const [, worldSlug, categorySlug] = match;
  // Never trust the model's slug without the registry agreeing.
  if (!getCategory(worldSlug, categorySlug)) return null;
  return { worldSlug, categorySlug };
}

/**
 * Find listings with registry-unknown world/category pairs and re-file
 * them. Bounded per run; the hourly cron drains any backlog over time.
 */
export async function fixUnknownCategories(
  limit = 10,
): Promise<{ scanned: number; mislabeled: number; fixed: number }> {
  if (!hasAnthropicEnv()) {
    console.log(
      "category-fixer: ANTHROPIC_API_KEY not set in this environment — skipping",
    );
    return { scanned: 0, mislabeled: 0, fixed: 0 };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: rows } = await admin
    .from("market_listings")
    .select("id, title, description, world_slug, category_slug")
    .order("created_at", { ascending: false })
    .limit(500);
  const scanned = rows?.length ?? 0;
  const mislabeled = (rows ?? []).filter(
    (r) => !getCategory(r.world_slug, r.category_slug),
  );
  if (mislabeled.length === 0) return { scanned, mislabeled: 0, fixed: 0 };

  const client = new Anthropic();
  let fixed = 0;
  for (const listing of mislabeled.slice(0, limit)) {
    try {
      const suggestion = await suggestCategory(client, listing);
      if (!suggestion) continue;
      const category = getCategory(suggestion.worldSlug, suggestion.categorySlug);
      if (!category) continue;
      const { error } = await admin
        .from("market_listings")
        .update({
          world_slug: suggestion.worldSlug,
          category_slug: suggestion.categorySlug,
          risk_family_slug: category.riskFamilySlug,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listing.id)
        // Guard against a concurrent edit having already fixed the row.
        .eq("category_slug", listing.category_slug);
      if (!error) {
        fixed += 1;
        console.log(
          `category-fixer: ${listing.id} "${listing.title}" → ${suggestion.worldSlug}/${suggestion.categorySlug}`,
        );
      }
    } catch (err) {
      // One bad listing (or an API hiccup) must not kill the sweep.
      console.error(`category-fixer: failed on ${listing.id}`, err);
    }
  }
  return { scanned, mislabeled: mislabeled.length, fixed };
}
