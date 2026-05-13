"use server";

import Papa from "papaparse";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

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

// Normalise header strings to lowercase alphanumeric so "Product Name",
// "product_name", and "productname" all resolve to the same key.
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Accept common variations operators might use in their own spreadsheets.
const HEADER_MAP: Record<string, string> = {
  name: "name", productname: "name", itemname: "name", title: "name",
  price: "price", baseprice: "price", rentalprice: "price",
  rate: "price", amount: "price", cost: "price",
  category: "category", categoryname: "category", type: "category",
  description: "description", shortdescription: "description",
  desc: "description", details: "description", notes: "description",
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

  // Load existing categories and product slugs in one round-trip each.
  const [{ data: existingCats }, { data: existingProducts }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("organization_id", ctx.organizationId),
    supabase.from("products").select("slug").eq("organization_id", ctx.organizationId).is("deleted_at", null),
  ]);

  const categoryMap = new Map<string, string>(
    (existingCats ?? []).map((c) => [c.name.toLowerCase(), c.id])
  );
  const existingSlugs = new Set((existingProducts ?? []).map((p) => p.slug));

  const errors: CsvImportResult["errors"] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // account for header row

    // Remap the normalised headers to our internal field names.
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

    if (existingSlugs.has(slug)) {
      skipped++;
      continue;
    }

    // Resolve category by name, creating it if it doesn't exist yet.
    let categoryId: string | null = null;
    const categoryName = (row.category ?? "").trim();
    if (categoryName) {
      const key = categoryName.toLowerCase();
      if (categoryMap.has(key)) {
        categoryId = categoryMap.get(key)!;
      } else {
        const { data: newCat } = await supabase
          .from("categories")
          .insert({ organization_id: ctx.organizationId, name: categoryName, slug: slugify(categoryName), sort_order: 99 })
          .select("id")
          .single();
        if (newCat) {
          categoryId = newCat.id;
          categoryMap.set(key, newCat.id);
        }
      }
    }

    const shortDescription = (row.description ?? "").slice(0, 300) || null;

    const { error: insertError } = await supabase.from("products").insert({
      organization_id: ctx.organizationId,
      name,
      slug,
      base_price: price,
      short_description: shortDescription,
      category_id: categoryId,
      is_active: true,
      visibility: "public",
    });

    if (insertError) {
      if (insertError.code === "23505") {
        skipped++;
      } else {
        errors.push({ row: rowNum, name, reason: insertError.message });
      }
    } else {
      existingSlugs.add(slug);
      imported++;
    }
  }

  if (imported > 0) {
    try {
      const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
      await markSetupStep(ctx.organizationId, "has_products");
    } catch { /* non-critical */ }
  }

  const total = rawRows.length;
  const parts: string[] = [];
  if (imported > 0) parts.push(`${imported} imported`);
  if (skipped > 0) parts.push(`${skipped} skipped (already exist)`);
  if (errors.length > 0) parts.push(`${errors.length} failed`);
  const message = parts.length > 0
    ? `${parts.join(", ")} out of ${total} rows.`
    : "Nothing to import — all rows were already in your catalog.";

  return { ok: true, imported, skipped, errors, message };
}
