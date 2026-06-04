"use client";

import { useActionState, useState, useEffect } from "react";
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
  // No default selection: forcing an explicit pick is the whole point of
  // the chooser. A pre-checked "inflatable" radio recreates the old
  // hardcoded behavior for anyone who skims the form.
  const [businessType, setBusinessType] = useState<"" | "inflatable" | "car" | "equipment">("");

  // Detect the browser timezone so a UK or Pacific operator isn't silently
  // defaulted to Eastern US time. Only honour it when it matches one of the
  // four options the dropdown actually exposes; otherwise the operator picks
  // manually. SSR uses Eastern as the fallback to avoid hydration mismatch.
  const KNOWN_TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
  ] as const;
  const [defaultTimezone, setDefaultTimezone] = useState<string>("America/New_York");
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && (KNOWN_TIMEZONES as readonly string[]).includes(detected)) {
        setDefaultTimezone(detected);
      }
    } catch {
      // Intl unavailable — keep the Eastern fallback.
    }
    // KNOWN_TIMEZONES is a static const; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the partial form to localStorage so a user who closes the tab
  // (or hits a network glitch mid-submit) can pick up where they left off.
  // Cleared on a successful submit (see effect below).
  const ONBOARDING_DRAFT_KEY = "korent-onboarding-draft";
  const [resumedDraft, setResumedDraft] = useState(false);
  useEffect(() => {
    if (state.ok && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  }, [state.ok]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        businessName?: string;
        slug?: string;
        slugEdited?: boolean;
        businessType?: "" | "inflatable" | "car" | "equipment";
      };
      let hydrated = false;
      if (draft.businessName) {
        setBusinessName(draft.businessName);
        hydrated = true;
      }
      if (draft.slug) {
        setSlug(draft.slug);
        hydrated = true;
      }
      if (draft.slugEdited) setSlugEdited(true);
      if (draft.businessType) {
        setBusinessType(draft.businessType);
        hydrated = true;
      }
      if (hydrated) setResumedDraft(true);
    } catch {
      // Corrupt JSON or storage blocked — silently start fresh.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only write a draft once the user has typed something non-trivial;
    // we don't want the resume banner to fire on a totally empty form.
    if (!businessName && !slug && !businessType) {
      return;
    }
    try {
      window.localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({ businessName, slug, slugEdited, businessType })
      );
    } catch {
      // Storage unavailable — skip silently; the form still works.
    }
  }, [businessName, slug, slugEdited, businessType]);

  useEffect(() => {
    if (!slugEdited && businessName) {
      setSlug(generateSlugClient(businessName));
    }
  }, [businessName, slugEdited]);

  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus("idle");
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      setSlugStatus("invalid");
      return;
    }

    // Debounce keystrokes AND abort any in-flight check before issuing the
    // next one. Without the AbortController, a slow response for "abc" could
    // arrive after a fresh response for "abcd" and stomp the displayed status.
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSlugStatus("checking");
      try {
        const res = await fetch(
          `/api/domains/check-slug?slug=${encodeURIComponent(slug)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSlugStatus(data.available ? "available" : "taken");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSlugStatus("idle");
      }
    }, 400);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [slug]);

  const submitDisabled =
    pending ||
    !businessType ||
    slugStatus === "taken" ||
    slugStatus === "invalid" ||
    slugStatus === "checking";

  const f = m.onboarding.form;

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <div className="kicker">{f.step1}</div>
        <strong style={{ fontSize: 15 }}>{f.yourBusiness}</strong>
      </div>

      <fieldset
        className="order-card"
        style={{ border: "none", padding: 16, margin: 0 }}
      >
        <legend style={{ padding: 0 }}>
          <strong>{f.businessType.label}</strong>
        </legend>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {f.businessType.hint}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 8,
            marginTop: 12,
          }}
        >
          {(["inflatable", "car", "equipment"] as const).map((value) => {
            const selected = businessType === value;
            const opt = f.businessType.options[value];
            // Keeping the radio input visible (rather than opacity:0)
            // keeps keyboard focus visible — when the operator tabs in,
            // the browser's native focus ring lands on something they
            // can see. The label/card highlight is the *selection*
            // affordance, the radio is the *focus* affordance.
            return (
              <label
                key={value}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 12,
                  border: selected
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                  // -1px on padding when selected so the 2px border
                  // doesn't shift surrounding cards as selection moves.
                  margin: selected ? 0 : 1,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: selected ? "var(--primary-bg)" : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="business_type"
                  value={value}
                  checked={selected}
                  onChange={() => setBusinessType(value)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong style={{ fontSize: 14 }}>{opt.label}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {opt.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

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
        <select
          key={defaultTimezone}
          name="timezone"
          defaultValue={defaultTimezone}
          style={{ marginTop: 10, width: "100%" }}
        >
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

      {resumedDraft && !state.ok && (
        <div
          role="status"
          className="badge info"
          style={{ padding: "10px 14px", display: "block" }}
        >
          {f.resumeBanner}
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
