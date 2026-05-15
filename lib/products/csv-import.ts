"use server";

import Papa from "papaparse";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { logAppError } from "@/lib/observability/server";

export type CsvImportResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: { row: number; name: string; reason: string }[];
  message: string;
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  name: "name", productname: "name", itemname: "name", title: "name",
  price: "price", baseprice: "price", rentalprice: "price",
  rate: "price", amount: "price", cost: "price",
  category: "category", categoryname: "category", type: "category",
  description: "description", shortdescription: "description",
  desc: "description", details: "description", notes: "description",
};

type ValidRow = {
  rowNum: number;
  name: string;
  slug: string;
  price: number;
  categoryName: string;
  description: string | null;
};

export async function importProductsFromCsv(
  formData: FormData
): Promise<CsvImportResult> {
  if (!hasSupabaseEnv()) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Not available in demo mode." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Not authorized." };
  }

  const file = formData.get("csv_file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "No file selected." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "File too large — maximum 2 MB." };
  }

  const text = await file.text();
  const { data: rawRows, errors: parseErrors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseHeader,
  });

  if (parseErrors.length > 0 && rawRows.length === 0) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Could not read the file. Please use the downloaded template." };
  }
  if (rawRows.length === 0) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "The file has no rows to import." };
  }
  if (rawRows.length > 500) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Maximum 500 rows per import." };
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: existingCats }, { data: existingProducts }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("organization_id", ctx.organizationId),
    supabase.from("products").select("slug").eq("organization_id", ctx.organizationId).is("deleted_at", null),
  ]);

  const categoryMap = new Map<string, string>(
    (existingCats ?? []).map((c) => [c.name.toLowerCase(), c.id])
  );
  const existingSlugs = new Set((existingProducts ?? []).map((p) => p.slug));

  const errors: CsvImportResult["errors"] = [];
  let skipped = 0;

  // ── Phase 1: validate all rows and collect unique new category names ────────
  const validRows: ValidRow[] = [];
  const seenSlugs = new Set<string>(); // track within-file slug collisions

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2;

    const row: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
      const mapped = HEADER_MAP[key];
      if (mapped) row[mapped] = (val ?? "").trim();
    }

    const name = row.name ?? "";
    if (!name) {
      errors.push({ row: rowNum, name: "(empty)", reason: "Name is required." });
      continue;
    }

    const rawPrice = (row.price ?? "").replace(/[^0-9.]/g, "");
    // Reject values with more than one decimal point (e.g. "1.99.50") that parseFloat
    // would silently accept, producing a wrong price.
    if ((rawPrice.match(/\./g) ?? []).length > 1) {
      errors.push({ row: rowNum, name, reason: "Price has multiple decimal points and is not a valid number." });
      continue;
    }
    const price = parseFloat(rawPrice);
    if (!rawPrice || isNaN(price) || price < 0) {
      errors.push({ row: rowNum, name, reason: "Price is missing or not a valid number." });
      continue;
    }

    const slug = slugify(name);
    if (!slug) {
      errors.push({ row: rowNum, name, reason: "Could not generate a valid URL slug from this name." });
      continue;
    }

    // Skip products that already exist in the catalog.
    if (existingSlugs.has(slug)) {
      skipped++;
      continue;
    }

    // Within-file duplicate: two rows with the same effective slug.
    if (seenSlugs.has(slug)) {
      errors.push({ row: rowNum, name, reason: `Duplicate of another row in this file (same URL slug "${slug}").` });
      continue;
    }
    seenSlugs.add(slug);

    validRows.push({
      rowNum,
      name,
      slug,
      price,
      categoryName: (row.category ?? "").trim(),
      description: (row.description ?? "").slice(0, 300) || null,
    });
  }

  // ── Phase 2: batch-create any categories that don't exist yet ──────────────
  const newCategoryNames = [
    ...new Set(
      validRows
        .map((r) => r.categoryName)
        .filter((n) => n && !categoryMap.has(n.toLowerCase()))
    ),
  ];

  if (newCategoryNames.length > 0) {
    const { data: newCats, error: catError } = await supabase
      .from("categories")
      .insert(
        newCategoryNames.map((catName) => ({
          organization_id: ctx.organizationId,
          name: catName,
          slug: slugify(catName),
          sort_order: 99,
        }))
      )
      .select("id, name");

    if (catError) {
      // Batch failed — fall back to individual inserts so partial success is preserved.
      await logAppError({
        organizationId: ctx.organizationId,
        source: "products.csv_import",
        message: "Batch category create failed, falling back to per-row",
        context: { reason: catError.message },
      });
      for (const catName of newCategoryNames) {
        const { data: cat, error: singleCatErr } = await supabase
          .from("categories")
          .insert({ organization_id: ctx.organizationId, name: catName, slug: slugify(catName), sort_order: 99 })
          .select("id, name")
          .single();
        if (cat) {
          categoryMap.set(cat.name.toLowerCase(), cat.id);
        } else if (singleCatErr) {
          // Category insert failed (e.g. slug collision) — products referencing this
          // category will be created without a category_id rather than silently wrong.
          await logAppError({
            organizationId: ctx.organizationId,
            source: "products.csv_import",
            message: "Individual category insert failed",
            context: { catName, reason: singleCatErr.message },
          });
        }
      }
    } else {
      for (const cat of newCats ?? []) {
        categoryMap.set(cat.name.toLowerCase(), cat.id);
      }
    }
  }

  // ── Phase 3: batch-insert products in chunks of 100 ───────────────────────
  const productRows = validRows.map((r) => ({
    organization_id: ctx.organizationId,
    name: r.name,
    slug: r.slug,
    base_price: r.price,
    short_description: r.description,
    category_id: r.categoryName ? (categoryMap.get(r.categoryName.toLowerCase()) ?? null) : null,
    is_active: true,
    visibility: "public",
  }));

  const CHUNK = 100;
  let imported = 0;

  for (let offset = 0; offset < productRows.length; offset += CHUNK) {
    const chunk = productRows.slice(offset, offset + CHUNK);
    const chunkRows = validRows.slice(offset, offset + CHUNK);

    const { error: insertError } = await supabase.from("products").insert(chunk);

    if (insertError) {
      // Batch failed — fall back to individual inserts to identify the bad rows.
      for (let j = 0; j < chunk.length; j++) {
        const { error: rowError } = await supabase.from("products").insert(chunk[j]);
        if (rowError) {
          errors.push({
            row: chunkRows[j].rowNum,
            name: chunkRows[j].name,
            reason: rowError.code === "23505"
              ? `A product with a similar name already exists (slug conflict: "${chunkRows[j].slug}").`
              : rowError.message,
          });
        } else {
          imported++;
        }
      }
    } else {
      imported += chunk.length;
    }
  }

  if (imported > 0) {
    try {
      const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
      await markSetupStep(ctx.organizationId, "has_products");
    } catch (err) {
      await logAppError({
        organizationId: ctx.organizationId,
        source: "products.csv_import",
        message: "Failed to mark setup step after CSV import",
        error: err,
      });
    }
  }

  const total = rawRows.length;
  const parts: string[] = [];
  if (imported > 0) parts.push(`${imported} imported`);
  if (skipped > 0) parts.push(`${skipped} skipped (already in catalog)`);
  if (errors.length > 0) parts.push(`${errors.length} failed`);
  const message = parts.length > 0
    ? `${parts.join(", ")} out of ${total} rows.`
    : "Nothing to import — all rows were already in your catalog.";

  return { ok: true, imported, skipped, errors, message };
}
