"use client";

import { useActionState, useState, useEffect } from "react";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { useI18n } from "@/lib/i18n/provider";
import type { VerticalOption } from "@/lib/verticals/options";

const initialState = { ok: false, message: "", storefrontUrl: "" };
const TOTAL_STEPS = 3;

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

export function OnboardingForm({
  verticalOptions,
  initialVertical = "",
}: {
  verticalOptions: VerticalOption[];
  /** Vertical picked on the signup page (from auth metadata); pre-selects
   *  the card here. Empty when they didn't choose one at signup. */
  initialVertical?: string;
}) {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const appDomain = getAppDomain();

  // Multi-step wizard. All step sections stay mounted (toggled with the
  // `hidden` attribute) so every field is still part of the single form
  // submission on the final step — only the active step is visible.
  const [step, setStep] = useState(1);

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [zip, setZip] = useState("");
  // Pre-selected from the signup-page pick when present; otherwise no
  // default, so an operator who skipped it still makes an explicit
  // choice. Options come from the vertical registry (server-built prop),
  // so this can never drift. A localStorage draft (below) can override.
  const [businessType, setBusinessType] = useState<string>(
    verticalOptions.some((o) => o.value === initialVertical) ? initialVertical : "",
  );

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
        businessType?: string;
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
      // Only restore a vertical that still exists in the registry — a
      // stale draft from a removed/renamed vertical is dropped.
      if (draft.businessType && verticalOptions.some((o) => o.value === draft.businessType)) {
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

  const f = m.onboarding.form;

  // Money defaults pre-filled from the chosen vertical (editable). The
  // inputs are uncontrolled with a `key` tied to businessType, so they
  // re-mount with the new vertical's defaults when the operator changes
  // their category. Manual edits persist within a vertical; switching
  // vertical re-seeds the suggested numbers (all still editable later).
  const selected = verticalOptions.find((o) => o.value === businessType);
  const money = selected?.defaults ?? {
    depositPercentage: 30,
    orderMinimum: 100,
    deliveryFee: 25,
  };

  const slugBlocked = ["taken", "invalid", "checking"].includes(slugStatus);
  const step1Valid = Boolean(businessType) && businessName.trim().length > 0 && !slugBlocked;
  const step2Valid = zip.trim().length > 0;
  const submitDisabled = pending || !step1Valid || slugStatus === "taken" || slugStatus === "invalid";

  const stepValid = step === 1 ? step1Valid : step === 2 ? step2Valid : true;
  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // Success — onboarding complete. Replaces the wizard entirely.
  if (state.ok && state.storefrontUrl) {
    return (
      <div
        className="panel"
        style={{ padding: "20px 24px", background: "#f0fdf4", borderLeft: "4px solid #22c55e", marginTop: 16 }}
      >
        <strong style={{ fontSize: 16, color: "#166534" }}>{f.siteLive}</strong>
        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>{f.customersCanFindYou}</div>
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
        <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>{f.bookmarkHint}</div>
        <div style={{ marginTop: 16 }}>
          <a href="/dashboard" className="primary-btn">{f.goToDashboard}</a>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      {/* Progress indicator */}
      <div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
          {f.stepOf.replace("{current}", String(step)).replace("{total}", String(TOTAL_STEPS))}
        </div>
        <div className="segmented-progress">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`segmented-progress__seg${i < step ? " segmented-progress__seg--on" : ""}`}
            />
          ))}
        </div>
      </div>

      {/* ── Step 1 — vertical + business ─────────────────────────────── */}
      <div hidden={step !== 1} className="list">
        <div style={{ marginBottom: 4 }}>
          <div className="kicker">{f.step1}</div>
          <strong style={{ fontSize: 15 }}>{f.yourBusiness}</strong>
        </div>

        <fieldset className="order-card" style={{ border: "none", padding: 16, margin: 0 }}>
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
            {verticalOptions.map(({ value, label, description, policySummary }) => {
              const isSel = businessType === value;
              return (
                <label
                  key={value}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 12,
                    border: isSel ? "2px solid var(--primary)" : "1px solid var(--border)",
                    margin: isSel ? 0 : 1,
                    borderRadius: 8,
                    cursor: "pointer",
                    background: isSel ? "var(--primary-bg)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="business_type"
                    value={value}
                    checked={isSel}
                    onChange={() => setBusinessType(value)}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <strong style={{ fontSize: 14 }}>{label}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>{description}</span>
                    {isSel ? (
                      <span style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 2 }}>
                        {policySummary}
                      </span>
                    ) : null}
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
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <div className="order-card">
          <strong>{f.storefrontUrl}</strong>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{f.storefrontHint}</div>
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
            <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>{f.slugStatus.invalid}</div>
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
      </div>

      {/* ── Step 2 — service area ────────────────────────────────────── */}
      <div hidden={step !== 2} className="list">
        <div style={{ marginBottom: 4 }}>
          <div className="kicker">{f.step2}</div>
          <strong style={{ fontSize: 15 }}>{f.whereDoYouDeliver}</strong>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{f.deliveryBlurb}</div>
        </div>

        <div className="grid grid-3">
          <label className="order-card">
            <strong>{f.primaryZip}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.primaryZipHint}</div>
            <input
              name="zip_code"
              type="text"
              placeholder={f.primaryZipPlaceholder}
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              style={{ marginTop: 10, width: "100%" }}
            />
          </label>

          <label className="order-card">
            <strong>{f.defaultDeliveryFee}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.defaultDeliveryFeeHint}</div>
            <input
              key={`fee-${businessType}`}
              name="delivery_fee"
              type="number"
              step="1"
              min="0"
              defaultValue={money.deliveryFee}
              style={{ marginTop: 10, width: "100%" }}
            />
          </label>

          <label className="order-card">
            <strong>{f.orderMinimum}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.orderMinimumHint}</div>
            <input
              key={`min-${businessType}`}
              name="minimum_order"
              type="number"
              step="1"
              min="0"
              defaultValue={money.orderMinimum}
              style={{ marginTop: 10, width: "100%" }}
            />
          </label>
        </div>
      </div>

      {/* ── Step 3 — deposit & cancellation ──────────────────────────── */}
      <div hidden={step !== 3} className="list">
        <div style={{ marginBottom: 4 }}>
          <div className="kicker">{f.step3}</div>
          <strong style={{ fontSize: 15 }}>{f.depositPolicy}</strong>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{f.depositBlurb}</div>
        </div>

        <label className="order-card">
          <strong>{f.depositLabel}</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.depositHint}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
            <input
              key={`dep-${businessType}`}
              name="deposit_percentage"
              type="number"
              step="1"
              min="0"
              max="100"
              defaultValue={money.depositPercentage}
              style={{ width: 90 }}
            />
            <span className="muted" style={{ fontSize: 14 }}>%</span>
          </div>
          {selected ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {f.cancellationLabel}: {selected.policySummary}
            </div>
          ) : null}
        </label>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      {resumedDraft && (
        <div
          role="status"
          className="badge info"
          style={{ padding: "10px 14px", display: "block", whiteSpace: "normal", lineHeight: 1.5 }}
        >
          {f.resumeBanner}
        </div>
      )}

      {/* ── Wizard navigation ────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {step > 1 && (
          <button type="button" className="secondary-btn" onClick={goBack} disabled={pending}>
            {f.back}
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            className="primary-btn"
            onClick={goNext}
            disabled={!stepValid}
            title={!stepValid ? f.completeStepHint : undefined}
          >
            {f.continue}
          </button>
        ) : (
          <button className="primary-btn" type="submit" disabled={submitDisabled}>
            {pending ? f.submitting : f.submit}
          </button>
        )}
      </div>
    </form>
  );
}
