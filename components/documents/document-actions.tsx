"use client";

import { useState } from "react";
import { updateDocumentStatus, createDocumentsForOrder } from "@/lib/documents/actions";

export function DocumentStatusButton({
  documentId,
  currentStatus,
  targetStatus,
  label,
}: {
  documentId: string;
  currentStatus: string;
  targetStatus: string;
  label: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const isAlreadyDone = currentStatus === targetStatus;

  async function handleClick() {
    setPending(true);
    setMessage("");
    const result = await updateDocumentStatus(documentId, targetStatus);
    setMessage(result.message);
    setPending(false);
    if (result.ok) {
      window.location.reload();
    }
  }

  if (isAlreadyDone) return null;

  return (
    <>
      <button
        className="secondary-btn"
        style={{ fontSize: 12, padding: "6px 12px" }}
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "Updating..." : label}
      </button>
      {message && <span className="muted" style={{ fontSize: 12 }}>{message}</span>}
    </>
  );
}

export function CreateDocumentsButton({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setPending(true);
    setMessage("");
    const result = await createDocumentsForOrder(orderId);
    setMessage(result.message);
    setPending(false);
    if (result.ok) {
      window.location.reload();
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        className="secondary-btn"
        style={{ fontSize: 12, padding: "6px 12px" }}
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "Creating..." : "Generate Documents"}
      </button>
      {message && <span className="muted" style={{ fontSize: 12 }}>{message}</span>}
    </div>
  );
}
