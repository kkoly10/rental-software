"use client";

import { useRef, useState, useTransition } from "react";
import { importProductsFromCsv, type CsvImportResult } from "@/lib/products/csv-import";
import { useI18n } from "@/lib/i18n/provider";

export function CsvImportButton({ onComplete }: { onComplete?: () => void }) {
  const { messages: m, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleClose() {
    setOpen(false);
    setResult(null);
    if (formRef.current) formRef.current.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await importProductsFromCsv(formData);
      setResult(res);
      if (res.ok && res.imported > 0 && onComplete) onComplete();
    });
  }

  return (
    <>
      <button
        type="button"
        className="secondary-btn"
        onClick={() => setOpen(true)}
      >
        {m.csvImport.button}
      </button>

      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 16, padding: 28,
              width: "100%", maxWidth: 480,
              boxShadow: "0 8px 40px rgba(0,0,0,.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>{m.csvImport.modalTitle}</strong>
              <button
                type="button"
                onClick={handleClose}
                aria-label={m.csvImport.closeAria}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#666", fontSize: 20, lineHeight: 1 }}
              >
                &#x2715;
              </button>
            </div>

            {!result ? (
              <>
                <div className="order-card" style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                    <strong>{m.csvImport.howItWorks}</strong>
                    <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "#55708f" }}>
                      <li>{m.csvImport.step1}</li>
                      <li>{m.csvImport.step2}</li>
                      <li>{m.csvImport.step3}</li>
                    </ol>
                  </div>
                  <a
                    href="/product-import-template.csv"
                    download
                    className="secondary-btn"
                    style={{ display: "inline-block", marginTop: 12, fontSize: 13 }}
                  >
                    {m.csvImport.downloadTemplate}
                  </a>
                </div>

                <form ref={formRef} onSubmit={handleSubmit}>
                  <div className="order-card" style={{ marginBottom: 16 }}>
                    <label style={{ display: "block" }}>
                      <strong style={{ fontSize: 14 }}>{m.csvImport.uploadLabel}</strong>
                      <input
                        ref={fileRef}
                        name="csv_file"
                        type="file"
                        accept=".csv,text/csv"
                        required
                        style={{ display: "block", marginTop: 10, width: "100%" }}
                      />
                    </label>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {m.csvImport.uploadHelp}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" className="primary-btn" disabled={isPending}>
                      {isPending ? m.csvImport.importing : m.csvImport.importProducts}
                    </button>
                    <button type="button" className="ghost-btn" onClick={handleClose}>
                      {m.csvImport.cancel}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div>
                <div
                  className="order-card"
                  style={{
                    marginBottom: 16,
                    borderLeft: `4px solid ${result.imported > 0 ? "#22c55e" : "#f59e0b"}`,
                  }}
                >
                  <strong style={{ fontSize: 14 }}>
                    {result.imported > 0 ? m.csvImport.importComplete : m.csvImport.nothingImported}
                  </strong>
                  <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>{result.message}</div>
                </div>

                {result.errors.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <strong style={{ fontSize: 13 }}>{m.csvImport.rowsWithErrors}</strong>
                    <div
                      style={{
                        marginTop: 8, maxHeight: 160, overflowY: "auto",
                        border: "1px solid #f0d0d0", borderRadius: 8, padding: "8px 12px",
                      }}
                    >
                      {result.errors.map((e) => (
                        <div key={e.row} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid #f5e0e0", color: "#991b1b" }}>
                          <strong>{t(m.csvImport.rowLabel, { row: e.row })}</strong> — {e.name}: {e.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  {result.imported > 0 ? (
                    <button type="button" className="primary-btn" onClick={handleClose}>
                      {m.csvImport.done}
                    </button>
                  ) : (
                    <button type="button" className="primary-btn" onClick={() => setResult(null)}>
                      {m.csvImport.tryAgain}
                    </button>
                  )}
                  {result.imported > 0 && (
                    <button type="button" className="ghost-btn" onClick={() => setResult(null)}>
                      {m.csvImport.importMore}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
