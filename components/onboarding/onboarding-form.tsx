"use client";

import { useActionState, useState, useCallback, useEffect } from "react";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "", storefrontUrl: "" };

function generateSlugClient(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

function getAppDomain() {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";
}

export function OnboardingForm() {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const appDomain = getAppDomain();

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  useEffect(() => {
    if (!slugEdited && businessName) {
      setSlug(generateSlugClient(businessName));
    }
  }, [businessName, slugEdited]);

  const checkSlug = useCallback(async (value: string) => {
    if (!value || value.length < 3) { setSlugStatus("idle"); return; }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) { setSlugStatus("invalid"); return; }
    setSlugStatus("checking");
    try {
      const res = await fetch(`/api/domains/check-slug?slug=${encodeURIComponent(value)}`);
      const data = await res.json();
      setSlugStatus(data.available ? "available" : "taken");
    } catch {
      setSlugStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (slug.length >= 3) {
      const t = setTimeout(() => checkSlug(slug), 400);
      return () => clearTimeout(t);
    }
  }, [slug, checkSlug]);

  const submitDisabled =
    pending ||
    slugStatus === "taken" ||
    slugStatus === "invalid" ||
    slugStatus === "checking";

  const f = m.onboarding.form;

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <input type="hidden" name="business_type" value="inflatable" />

      <div style={{ marginBottom: 4 }}>
        <div className="kicker">{f.step1}</div>
        <strong style={{ fontSize: 15 }}>{f.yourBusiness}</strong>
      </div>

      <label className="order-card">
        <strong>{f.businessName}</strong>
        <input
          name="business_name"
          type="text"
          placeholder={f.businessNamePlaceholder}
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <div className="order-card">
        <strong>{f.storefrontUrl}</strong>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {f.storefrontHint}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
          <input
            name="slug"
            type="text"
            value={slug}
            onChange={(e) => {
              const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
              setSlug(v);
              setSlugEdited(true);
            }}
            onBlur={() => checkSlug(slug)}
            style={{ width: 200, fontFamily: "monospace" }}
            maxLength={63}
          />
          <span className="muted" style={{ fontSize: 14 }}>.{appDomain}</span>
        </div>
        {slugStatus === "checking" && (
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{f.slugStatus.checking}</div>
        )}
        {slugStatus === "available" && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#16a34a" }}>{f.slugStatus.available}</div>
        )}
        {slugStatus === "taken" && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>{f.slugStatus.taken}</div>
        )}
        {slugStatus === "invalid" && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>
            {f.slugStatus.invalid}
          </div>
        )}
      </div>

      <label className="order-card">
        <strong>{f.timezone}</strong>
        <select name="timezone" defaultValue="America/New_York" style={{ marginTop: 10, width: "100%" }}>
          <option value="America/New_York">{f.timezoneOptions.eastern}</option>
          <option value="America/Chicago">{f.timezoneOptions.central}</option>
          <option value="America/Denver">{f.timezoneOptions.mountain}</option>
          <option value="America/Los_Angeles">{f.timezoneOptions.pacific}</option>
        </select>
      </label>

      <div style={{ marginTop: 8, marginBottom: 4 }}>
        <div className="kicker">{f.step2}</div>
        <strong style={{ fontSize: 15 }}>{f.whereDoYouDeliver}</strong>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {f.deliveryBlurb}
        </div>
      </div>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{f.primaryZip}</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.primaryZipHint}</div>
          <input
            name="zip_code"
            type="text"
            placeholder={f.primaryZipPlaceholder}
            required
            inputMode="numeric"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{f.defaultDeliveryFee}</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.defaultDeliveryFeeHint}</div>
          <input
            name="delivery_fee"
            type="number"
            step="1"
            min="0"
            defaultValue={25}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{f.orderMinimum}</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.orderMinimumHint}</div>
          <input
            name="minimum_order"
            type="number"
            step="1"
            min="0"
            defaultValue={100}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      {state.ok && state.storefrontUrl ? (
        <div
          className="panel"
          style={{ padding: "20px 24px", background: "#f0fdf4", borderLeft: "4px solid #22c55e" }}
        >
          <strong style={{ fontSize: 16, color: "#166534" }}>{f.siteLive}</strong>
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
            {f.customersCanFindYou}
          </div>
          <div style={{ marginTop: 6 }}>
            <a
              href={state.storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 600, color: "var(--primary)" }}
            >
              {state.storefrontUrl} &#8599;
            </a>
          </div>
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            {f.bookmarkHint}
          </div>
          <div style={{ marginTop: 16 }}>
            <a href="/dashboard" className="primary-btn">{f.goToDashboard}</a>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12 }}>
          <button className="primary-btn" type="submit" disabled={submitDisabled}>
            {pending ? f.submitting : f.submit}
          </button>
        </div>
      )}
    </form>
  );
}
