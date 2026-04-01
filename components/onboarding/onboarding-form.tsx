"use client";

import { useActionState, useState, useCallback, useEffect } from "react";
import { completeOnboarding } from "@/lib/onboarding/actions";

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
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const appDomain = getAppDomain();

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  // Auto-generate slug from business name (unless user manually edited)
  useEffect(() => {
    if (!slugEdited && businessName) {
      setSlug(generateSlugClient(businessName));
    }
  }, [businessName, slugEdited]);

  const checkSlug = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setSlugStatus("idle");
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
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
  }, []);

  // Check availability when slug changes via auto-generation
  useEffect(() => {
    if (slug.length >= 3) {
      const t = setTimeout(() => checkSlug(slug), 400);
      return () => clearTimeout(t);
    }
  }, [slug, checkSlug]);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>Business name</strong>
        <input
          name="business_name"
          type="text"
          placeholder="e.g. Fun Zone Inflatables"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <div className="order-card">
        <strong>Storefront URL</strong>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          This is the web address customers will use to find your rental site.
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
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Checking...</div>
        )}
        {slugStatus === "available" && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#16a34a" }}>&#10003; Available</div>
        )}
        {slugStatus === "taken" && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>Already taken — try a different one.</div>
        )}
        {slugStatus === "invalid" && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>
            Must be 3+ lowercase letters, numbers, and hyphens.
          </div>
        )}
      </div>

      <label className="order-card">
        <strong>Timezone</strong>
        <select name="timezone" defaultValue="America/New_York" style={{ marginTop: 10, width: "100%" }}>
          <option value="America/New_York">Eastern (ET)</option>
          <option value="America/Chicago">Central (CT)</option>
          <option value="America/Denver">Mountain (MT)</option>
          <option value="America/Los_Angeles">Pacific (PT)</option>
        </select>
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Primary ZIP code</strong>
          <input
            name="zip_code"
            type="text"
            placeholder="22554"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Default delivery fee</strong>
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
          <strong>Minimum order ($)</strong>
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

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      {state.ok && state.storefrontUrl && (
        <div
          className="panel"
          style={{
            padding: "16px 20px",
            background: "#f0fdf4",
            borderLeft: "4px solid #22c55e",
          }}
        >
          <strong style={{ color: "#166534" }}>Your rental site is live!</strong>
          <div style={{ marginTop: 6, fontSize: 14 }}>
            <a
              href={state.storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: "monospace", color: "var(--primary)" }}
            >
              {state.storefrontUrl} &#8599;
            </a>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          className="primary-btn"
          type="submit"
          disabled={pending || slugStatus === "taken" || slugStatus === "invalid"}
        >
          {pending ? "Setting up..." : "Create Business & Continue"}
        </button>
      </div>
    </form>
  );
}
