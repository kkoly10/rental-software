"use client";

import { useActionState, useState } from "react";
import { signDocument, type SignDocumentState } from "@/lib/portal/sign-document";

type DocumentEntry = {
  id: string;
  type: string;
  status: string;
};

type Props = {
  documents: DocumentEntry[];
  portalToken: string;
};

export function DocumentSign({ documents, portalToken }: Props) {
  const [signingDocId, setSigningDocId] = useState<string | null>(null);

  if (documents.length === 0) return null;

  const pendingDocs = documents.filter((d) => d.status === "pending");
  const signedDocs = documents.filter((d) => d.status !== "pending");

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h3 style={{ margin: 0 }}>Documents</h3>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {signedDocs.map((doc) => (
          <div key={doc.id} className="order-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{doc.type}</span>
            <span className="badge success">Signed</span>
          </div>
        ))}

        {pendingDocs.map((doc) => (
          <div key={doc.id}>
            <div className="order-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{doc.type}</span>
              {signingDocId === doc.id ? (
                <button
                  type="button"
                  className="badge default"
                  style={{ cursor: "pointer", border: "none" }}
                  onClick={() => setSigningDocId(null)}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="badge warning"
                  style={{ cursor: "pointer", border: "none" }}
                  onClick={() => setSigningDocId(doc.id)}
                >
                  Accept &amp; Sign
                </button>
              )}
            </div>

            {signingDocId === doc.id && (
              <SignForm
                documentId={doc.id}
                documentType={doc.type}
                portalToken={portalToken}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SignForm({
  documentId,
  documentType,
  portalToken,
}: {
  documentId: string;
  documentType: string;
  portalToken: string;
}) {
  const [state, formAction, pending] = useActionState<SignDocumentState, FormData>(
    signDocument,
    { ok: true, message: "" }
  );

  if (state.ok && state.message && state.message.includes("successfully")) {
    return (
      <div className="portal-sign-form">
        <div className="badge success" style={{ marginTop: 8 }}>{state.message}</div>
      </div>
    );
  }

  return (
    <form action={formAction} className="portal-sign-form">
      <input type="hidden" name="document_id" value={documentId} />
      <input type="hidden" name="portal_token" value={portalToken} />

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Full name</span>
        <input
          name="signer_name"
          type="text"
          placeholder="Your full legal name"
          required
        />
      </label>

      <label className="portal-sign-checkbox">
        <input name="agreed" type="checkbox" required />
        <span style={{ fontSize: 13 }}>
          I have read and agree to the terms of this {documentType.toLowerCase()}.
          I understand my responsibilities as the renter.
        </span>
      </label>

      {!state.ok && state.message && (
        <div className="badge warning">{state.message}</div>
      )}

      <button type="submit" className="primary-btn" disabled={pending} style={{ marginTop: 4 }}>
        {pending ? "Signing..." : "Sign Document"}
      </button>
    </form>
  );
}
