"use client";

import { useState, useCallback, useActionState } from "react";
import { setCustomDomain, removeCustomDomain } from "@/lib/settings/domain-actions";
import type { DomainSettings } from "@/lib/data/domain-settings";

const initialState = { ok: false, message: "" };

function getAppDomain() {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";
}

export function DomainSettingsPanel({ defaults }: { defaults: DomainSettings }) {
  const appDomain = getAppDomain();

  // Slug editing
  const [slug, setSlug] = useState(defaults.slug);
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugInput, setSlugInput] = useState(defaults.slug);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugMessage, setSlugMessage] = useState("");

  // Custom domain
  const [domainState, domainAction, domainPending] = useActionState(setCustomDomain, initialState);
  const [customDomain, setCustomDomainLocal] = useState(defaults.customDomain);
  const [domainVerified, setDomainVerified] = useState(defaults.customDomainVerified);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [removing, setRemoving] = useState(false);

  const checkSlugAvailability = useCallback(
    async (value: string) => {
      if (value === slug) {
        setSlugStatus("idle");
        return;
      }
      if (value.length < 3 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
        setSlugStatus("invalid");
        return;
      }
      setSlugStatus("checking");
      try {
        const res = await fetch(`/api/domains/check-slug?slug=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSlugStatus(data.available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    },
    [slug]
  );

  async function saveSlug() {
    if (slugInput === slug) {
      setSlugEditing(false);
      return;
    }
    setSlugSaving(true);
    setSlugMessage("");
    try {
      const res = await fetch("/api/domains/update-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slugInput }),
      });
      const data = await res.json();
      if (data.ok) {
        setSlug(data.slug);
        setSlugEditing(false);
        setSlugMessage("Slug updated. The new URL may take a few minutes to resolve everywhere.");
      } else {
        setSlugMessage(data.error ?? "Failed to update slug.");
      }
    } catch {
      setSlugMessage("Network error.");
    } finally {
      setSlugSaving(false);
    }
  }

  async function verifyDomain() {
    setVerifying(true);
    setVerifyMessage("");
    try {
      const res = await fetch("/api/domains/verify", { method: "POST" });
      const data = await res.json();
      if (data.verified) {
        setDomainVerified(true);
        setVerifyMessage("Domain verified successfully!");
      } else {
        setVerifyMessage(data.message ?? "Verification failed.");
      }
    } catch {
      setVerifyMessage("Network error.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleRemoveDomain() {
    if (!confirm("Remove your custom domain? Your storefront will only be accessible via your subdomain URL.")) return;
    setRemoving(true);
    try {
      const result = await removeCustomDomain();
      if (result.ok) {
        setCustomDomainLocal(null);
        setDomainVerified(false);
        setShowDomainForm(false);
        setVerifyMessage("");
      }
    } catch {
      // ignore
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="list">
      {/* Subdomain section */}
      <div className="order-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <strong>Subdomain URL</strong>
            <div className="muted" style={{ marginTop: 4 }}>
              This is your default storefront URL. DNS and platform routing changes can take a few minutes to fully propagate.
            </div>
          </div>
          {!slugEditing && (
            <button
              className="ghost-btn"
              style={{ fontSize: 13 }}
              onClick={() => {
                setSlugInput(slug);
                setSlugEditing(true);
                setSlugStatus("idle");
                setSlugMessage("");
              }}
            >
              Edit
            </button>
          )}
        </div>

        {slugEditing ? (
          <div style={{ marginTop: 12 }}>
            <div className="domain-slug-row" style={{ fontSize: 14 }}>
              <input
                type="text"
                value={slugInput}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                  setSlugInput(v);
                }}
                onBlur={() => checkSlugAvailability(slugInput)}
                style={{ fontFamily: "monospace" }}
                maxLength={63}
              />
              <span className="muted">.{appDomain}</span>
            </div>

            {slugStatus === "checking" && (
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Checking availability...</div>
            )}
            {slugStatus === "available" && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#16a34a" }}>Available!</div>
            )}
            {slugStatus === "taken" && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>Already taken or reserved.</div>
            )}
            {slugStatus === "invalid" && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>
                Must be 3-63 lowercase letters, numbers, and hyphens.
              </div>
            )}

            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#fef3c7", fontSize: 13, color: "#92400e" }}>
              Your old URL will stop working immediately. Customers using your current URL will need the new one.
            </div>

            <div className="inline-form-actions" style={{ marginTop: 10 }}>
              <button
                className="primary-btn"
                style={{ fontSize: 13 }}
                disabled={slugSaving || slugStatus === "taken" || slugStatus === "invalid" || slugInput === slug}
                onClick={saveSlug}
              >
                {slugSaving ? "Saving..." : "Save"}
              </button>
              <button
                className="ghost-btn"
                style={{ fontSize: 13 }}
                onClick={() => setSlugEditing(false)}
              >
                Cancel
              </button>
            </div>

            {slugMessage && (
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{slugMessage}</div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <a
              href={`https://${slug}.${appDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: "monospace", fontSize: 14, color: "var(--primary)" }}
            >
              {slug}.{appDomain} &#8599;
            </a>
          </div>
        )}
      </div>

      {/* Custom domain section */}
      <div className="order-card">
        <strong>Custom Domain</strong>
        <div className="muted" style={{ marginTop: 4 }}>
          Use your own domain name for your storefront (optional).
        </div>

        {customDomain ? (
          <div style={{ marginTop: 12 }}>
            <div className="domain-url-row" style={{ marginBottom: 10 }}>
              <a
                href={`https://${customDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "monospace", fontSize: 14, color: "var(--primary)" }}
              >
                {customDomain} &#8599;
              </a>
              <span
                className="badge"
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background: domainVerified ? "#dcfce7" : "#fef9c3",
                  color: domainVerified ? "#166534" : "#854d0e",
                }}
              >
                {domainVerified ? "Verified" : "Pending verification"}
              </span>
            </div>

            {!domainVerified && (
              <>
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-muted)", fontSize: 13, lineHeight: 1.7 }}>
                  <strong>DNS Configuration</strong>
                  <div style={{ marginTop: 6 }}>
                    1. Add a <strong>CNAME</strong> record pointing <code>{customDomain}</code> to <code>cname.vercel-dns.com</code>
                  </div>
                  <div>
                    2. If using an apex domain (no www), add an <strong>A</strong> record pointing to <code>76.76.21.21</code>
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    DNS changes can take up to 48 hours to propagate.
                  </div>
                </div>

                <button
                  className="secondary-btn"
                  style={{ marginTop: 10, fontSize: 13 }}
                  disabled={verifying}
                  onClick={verifyDomain}
                >
                  {verifying ? "Verifying..." : "Verify Domain"}
                </button>
              </>
            )}

            {verifyMessage && (
              <div
                className="muted"
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: domainVerified ? "#16a34a" : "#92400e",
                }}
              >
                {verifyMessage}
              </div>
            )}

            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <button
                className="ghost-btn"
                style={{ fontSize: 12, color: "#dc2626" }}
                disabled={removing}
                onClick={handleRemoveDomain}
              >
                {removing ? "Removing..." : "Remove Domain"}
              </button>
            </div>

            {domainVerified && (
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                After verification, it may take a few minutes for your custom domain to go live with HTTPS.
              </div>
            )}
          </div>
        ) : showDomainForm ? (
          <form action={domainAction} style={{ marginTop: 12 }}>
            <label>
              <span className="muted" style={{ fontSize: 13 }}>Domain name</span>
              <input
                name="domain"
                type="text"
                placeholder="e.g., myrentals.com"
                required
                style={{ marginTop: 6, width: "100%", fontFamily: "monospace" }}
              />
            </label>

            {domainState.message && (
              <div
                className={domainState.ok ? "badge success" : "badge warning"}
                style={{ padding: "8px 12px", marginTop: 10 }}
              >
                {domainState.message}
              </div>
            )}

            <div className="inline-form-actions" style={{ marginTop: 10 }}>
              <button className="primary-btn" type="submit" disabled={domainPending} style={{ fontSize: 13 }}>
                {domainPending ? "Saving..." : "Save Domain"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                style={{ fontSize: 13 }}
                onClick={() => setShowDomainForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className="secondary-btn"
            style={{ marginTop: 10, fontSize: 13 }}
            onClick={() => setShowDomainForm(true)}
          >
            Add Custom Domain
          </button>
        )}
      </div>
    </div>
  );
}
