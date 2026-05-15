"use client";

import { useState, useCallback, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setCustomDomain, removeCustomDomain } from "@/lib/settings/domain-actions";
import type { DomainSettings } from "@/lib/data/domain-settings";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const initialState = { ok: false, message: "", savedDomain: undefined as string | undefined };

function getAppDomain() {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";
}

export function DomainSettingsPanel({ defaults }: { defaults: DomainSettings }) {
  const appDomain = getAppDomain();
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.forms.domainSettings;

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
  const [removeError, setRemoveError] = useState("");

  // When setCustomDomain succeeds, transition the UI from "add form" to
  // the saved domain display without requiring a full page reload.
  useEffect(() => {
    if (domainState.ok && domainState.savedDomain) {
      setCustomDomainLocal(domainState.savedDomain);
      setDomainVerified(false);
      setShowDomainForm(false);
      router.refresh();
    }
  }, [domainState]);

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
        setSlugMessage(m.slugUpdated);
        router.refresh();
      } else {
        setSlugMessage(data.error ?? m.slugUpdateFailed);
      }
    } catch {
      setSlugMessage(m.networkError);
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
        setVerifyMessage(m.verifySuccess);
        router.refresh();
      } else {
        setVerifyMessage(data.message ?? m.verifyFailed);
      }
    } catch {
      setVerifyMessage(m.networkError);
    } finally {
      setVerifying(false);
    }
  }

  async function handleRemoveDomain() {
    if (!confirm(m.removeConfirm)) return;
    setRemoving(true);
    setRemoveError("");
    try {
      const result = await removeCustomDomain();
      if (result.ok) {
        setCustomDomainLocal(null);
        setDomainVerified(false);
        setShowDomainForm(false);
        setVerifyMessage("");
        router.refresh();
      } else {
        setRemoveError(result.message ?? m.removeFailed);
      }
    } catch {
      setRemoveError(m.networkRetry);
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
            <strong>{m.subdomainHeading}</strong>
            <div className="muted" style={{ marginTop: 4 }}>
              {m.subdomainHelp}
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
              {m.edit}
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
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{m.checking}</div>
            )}
            {slugStatus === "available" && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#16a34a" }}>{m.available}</div>
            )}
            {slugStatus === "taken" && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>{m.taken}</div>
            )}
            {slugStatus === "invalid" && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>
                {m.invalid}
              </div>
            )}

            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#fef3c7", fontSize: 13, color: "#92400e" }}>
              {m.changeWarning}
            </div>

            <div className="inline-form-actions" style={{ marginTop: 10 }}>
              <button
                className="primary-btn"
                style={{ fontSize: 13 }}
                disabled={slugSaving || slugStatus === "taken" || slugStatus === "invalid" || slugInput === slug}
                onClick={saveSlug}
              >
                {slugSaving ? m.saving : m.save}
              </button>
              <button
                className="ghost-btn"
                style={{ fontSize: 13 }}
                onClick={() => setSlugEditing(false)}
              >
                {m.cancel}
              </button>
            </div>

            {slugMessage && (
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{slugMessage}</div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {slug ? (
              <a
                href={`https://${slug}.${appDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "monospace", fontSize: 14, color: "var(--primary)" }}
              >
                {slug}.{appDomain} &#8599;
              </a>
            ) : (
              <span className="muted" style={{ fontSize: 13 }}>
                {m.noSubdomain}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Custom domain section */}
      <div className="order-card">
        <strong>{m.customDomainHeading}</strong>
        <div className="muted" style={{ marginTop: 4 }}>
          {m.customDomainHelp}
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
                {domainVerified ? m.statusVerified : m.statusPending}
              </span>
            </div>

            {!domainVerified && (
              <>
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-muted)", fontSize: 13, lineHeight: 1.7 }}>
                  <strong>{m.dnsHeading}</strong>
                  <div style={{ marginTop: 6 }}>
                    {formatMessage(m.dnsStep1, { domain: customDomain })}
                  </div>
                  <div>
                    {m.dnsStep2}
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    {m.dnsPropagationNote}
                  </div>
                </div>

                <button
                  className="secondary-btn"
                  style={{ marginTop: 10, fontSize: 13 }}
                  disabled={verifying}
                  onClick={verifyDomain}
                >
                  {verifying ? m.verifying : m.verifyDomain}
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
                {removing ? m.removing : m.removeDomain}
              </button>
              {removeError && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--danger, #dc2626)" }}>{removeError}</p>
              )}
            </div>

            {domainVerified && (
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {m.httpsNote}
              </div>
            )}
          </div>
        ) : showDomainForm ? (
          <form action={domainAction} style={{ marginTop: 12 }}>
            <label>
              <span className="muted" style={{ fontSize: 13 }}>{m.domainNameLabel}</span>
              <input
                name="domain"
                type="text"
                placeholder={m.domainNamePlaceholder}
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
                {domainPending ? m.savingDomain : m.saveDomain}
              </button>
              <button
                type="button"
                className="ghost-btn"
                style={{ fontSize: 13 }}
                onClick={() => setShowDomainForm(false)}
              >
                {m.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            className="secondary-btn"
            style={{ marginTop: 10, fontSize: 13 }}
            onClick={() => setShowDomainForm(true)}
          >
            {m.addCustomDomain}
          </button>
        )}
      </div>
    </div>
  );
}
