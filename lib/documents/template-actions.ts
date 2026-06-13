"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type TemplateActionState = { ok: boolean; message: string };

const DOC_TYPES = ["rental_agreement", "safety_waiver"] as const;
type DocType = (typeof DOC_TYPES)[number];

const MAX_CLAUSES = 40;
const MAX_CLAUSE_LEN = 4000;

async function requireOwnerAdmin(): Promise<
  | { ok: true; orgId: string; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; state: TemplateActionState }
> {
  if (!hasSupabaseEnv()) {
    return { ok: false, state: { ok: false, message: "Not available in this environment." } };
  }
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, state: { ok: false, message: "Not authenticated." } };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (data?.role !== "owner" && data?.role !== "admin") {
    return { ok: false, state: { ok: false, message: "Only owners and admins can edit documents." } };
  }
  return { ok: true, orgId: ctx.organizationId, supabase };
}

/**
 * Save an operator-edited clause set for one document type. Clauses
 * arrive as repeated `clause` form fields (in display order); blanks are
 * dropped. Saving with zero non-empty clauses is rejected — to revert to
 * the built-in defaults the operator uses resetDocumentTemplate instead.
 */
export async function saveDocumentTemplate(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const documentType = String(formData.get("document_type") ?? "");
  if (!DOC_TYPES.includes(documentType as DocType)) {
    return { ok: false, message: "Invalid document type." };
  }

  const clauses = formData
    .getAll("clause")
    .map((c) => String(c).trim())
    .filter((c) => c.length > 0)
    .slice(0, MAX_CLAUSES)
    .map((c) => c.slice(0, MAX_CLAUSE_LEN));

  if (clauses.length === 0) {
    return {
      ok: false,
      message: "Add at least one clause, or use “Reset to default” to restore the built-in terms.",
    };
  }

  const auth = await requireOwnerAdmin();
  if (!auth.ok) return auth.state;

  const { error } = await auth.supabase.from("document_templates").upsert(
    {
      organization_id: auth.orgId,
      document_type: documentType,
      clauses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,document_type" },
  );
  if (error) {
    return { ok: false, message: "Couldn't save your changes. Please try again." };
  }
  revalidatePath("/dashboard/settings/documents");
  return { ok: true, message: "Saved. New agreements and waivers will use your edited terms." };
}

/** Revert a document type to the built-in per-vertical defaults by
 *  deleting the override row. */
export async function resetDocumentTemplate(formData: FormData): Promise<void> {
  const documentType = String(formData.get("document_type") ?? "");
  if (!DOC_TYPES.includes(documentType as DocType)) return;

  const auth = await requireOwnerAdmin();
  if (!auth.ok) return;

  await auth.supabase
    .from("document_templates")
    .delete()
    .eq("organization_id", auth.orgId)
    .eq("document_type", documentType);
  revalidatePath("/dashboard/settings/documents");
}
