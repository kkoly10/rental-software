import type { ReactNode } from "react";
import { getMessages } from "@/lib/i18n/server";

export async function ListSearchForm({
  placeholder,
  initialQuery,
  actions,
}: {
  placeholder: string;
  initialQuery?: string;
  actions?: ReactNode;
}) {
  const m = await getMessages();
  return (
    <form method="get" className="order-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          name="q"
          defaultValue={initialQuery ?? ""}
          placeholder={placeholder}
          style={{ flex: "1 1 280px", minWidth: 220 }}
        />
        <button type="submit" className="secondary-btn">
          {m.common.search}
        </button>
        {initialQuery ? (
          <a href="?" className="ghost-btn">
            {m.common.close}
          </a>
        ) : null}
        {actions}
      </div>
    </form>
  );
}
