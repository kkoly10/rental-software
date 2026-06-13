import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";
import { getTerms, type DocumentTermsType } from "@/lib/documents/terms";
import { DocumentTemplateEditor } from "@/components/settings/document-template-editor";

export const dynamic = "force-dynamic";

/**
 * Operator document-template editor (Phase D, full clause editor). Lets
 * owners/admins edit the rental-agreement and safety-waiver clauses their
 * org's documents use. Edits are stored in document_templates and replace
 * the built-in per-vertical defaults; a reset deletes the override.
 */
export default async function DocumentTemplatesPage() {
  const ctx = await getOrgContext();

  const stored: Record<string, string[]> = {};
  let primaryVertical = "inflatable";

  if (ctx) {
    const supabase = await createSupabaseServerClient();
    const [{ data: rows }, pv] = await Promise.all([
      supabase
        .from("document_templates")
        .select("document_type, clauses")
        .eq("organization_id", ctx.organizationId),
      getPrimaryVerticalSlug(),
    ]);
    primaryVertical = pv || "inflatable";
    for (const r of rows ?? []) {
      if (Array.isArray(r.clauses)) {
        stored[r.document_type as string] = (r.clauses as unknown[]).filter(
          (c): c is string => typeof c === "string" && c.trim().length > 0,
        );
      }
    }
  }

  const build = (type: DocumentTermsType) => {
    const custom = stored[type] ?? [];
    return {
      clauses: custom.length > 0 ? custom : getTerms(type, primaryVertical),
      isCustom: custom.length > 0,
    };
  };
  const agreement = build("rental_agreement");
  const waiver = build("safety_waiver");

  return (
    <DashboardShell
      title="Document templates"
      description="Edit the clauses on your rental agreement and safety waiver. Changes apply to documents generated from here on."
    >
      <Link href="/dashboard/settings" className="ghost-btn">
        ← Back to settings
      </Link>

      <div className="badge warning" style={{ display: "block", padding: "12px 16px", marginTop: 16, lineHeight: 1.5 }}>
        <strong>Editing replaces the built-in terms for this document.</strong> Keep your
        liability, damage-responsibility, and indemnification clauses — they protect your
        business. We recommend having an attorney review any custom legal text.
      </div>

      <DocumentTemplateEditor
        documentType="rental_agreement"
        title="Rental agreement"
        initialClauses={agreement.clauses}
        isCustom={agreement.isCustom}
      />
      <DocumentTemplateEditor
        documentType="safety_waiver"
        title="Safety waiver"
        initialClauses={waiver.clauses}
        isCustom={waiver.isCustom}
      />
    </DashboardShell>
  );
}
