"use client";

import { useActionState, useState } from "react";
import { signDocument, type SignDocumentState } from "@/lib/portal/sign-document";
import { SignatureCanvasInput } from "./signature-canvas";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

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
  const { messages: m } = useI18n();
  const [signingDocId, setSigningDocId] = useState<string | null>(null);

  if (documents.length === 0) return null;

  const pendingDocs = documents.filter((d) => d.status === "pending");
  const signedDocs = documents.filter((d) => d.status !== "pending");

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h3 style={{ margin: 0 }}>{m.portal.documents.title}</h3>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {signedDocs.map((doc) => (
          <div key={doc.id} className="order-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{doc.type}</span>
            <span className="badge success">{m.portal.documents.signed}</span>
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
                  {m.portal.documents.cancel}
                </button>
              ) : (
                <button
                  type="button"
                  className="badge warning"
                  style={{ cursor: "pointer", border: "none" }}
                  onClick={() => setSigningDocId(doc.id)}
                >
                  {m.portal.documents.acceptAndSign}
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
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState<SignDocumentState, FormData>(
    signDocument,
    { ok: true, message: "" }
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  if (state.ok && state.message) {
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
      <input type="hidden" name="signature_data_url" value={signatureDataUrl ?? ""} />

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.portal.documents.fullName}</span>
        <input
          name="signer_name"
          type="text"
          placeholder={m.portal.documents.fullNamePlaceholder}
          required
        />
      </label>

      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.portal.documents.drawSignature}</span>
        <SignatureCanvasInput onChange={setSignatureDataUrl} />
        {!signatureDataUrl && (
          <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
            {m.portal.documents.signatureOptionalHint}
          </span>
        )}
      </div>

      <label className="portal-sign-checkbox">
        <input name="agreed" type="checkbox" required />
        <span style={{ fontSize: 13 }}>
          {formatMessage(m.portal.documents.agreeText, { documentType: documentType.toLowerCase() })}
        </span>
      </label>

      {!state.ok && state.message && (
        <div className="badge warning">{state.message}</div>
      )}

      <button type="submit" className="primary-btn" disabled={pending} style={{ marginTop: 4 }}>
        {pending ? m.portal.documents.signing : m.portal.documents.sign}
      </button>
    </form>
  );
}
