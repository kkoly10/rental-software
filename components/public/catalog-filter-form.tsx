import { getMessages } from "@/lib/i18n/server";

type CategoryOption = {
  value: string;
  label: string;
};

type CatalogFilterFormProps = {
  initialDate?: string;
  initialZip?: string;
  initialCategory?: string;
  categories?: CategoryOption[];
};

/**
 * Editorial catalog filter — same hairline-bar pattern as the hero
 * availability bar: date / ZIP / category cells in a single 1px-border
 * rectangle with a black uppercase submit. Stacks on mobile with a
 * full-width button.
 */
export async function CatalogFilterForm({
  initialDate = "",
  initialZip = "",
  initialCategory = "",
  categories = [],
}: CatalogFilterFormProps) {
  const m = await getMessages();
  return (
    <form action="/inventory" className="st-filter-bar" role="search">
      <label className="st-filter-field">
        <span className="st-eyebrow">{m.storefront.hero.eventDate}</span>
        <input name="date" type="date" defaultValue={initialDate} autoComplete="off" />
      </label>

      <label className="st-filter-field">
        <span className="st-eyebrow">{m.storefront.hero.deliveryZip}</span>
        <input
          name="zip"
          type="text"
          defaultValue={initialZip}
          placeholder={m.storefront.hero.zipPlaceholder}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          pattern="[0-9-]*"
        />
      </label>

      {categories.length > 0 && (
        <label className="st-filter-field">
          <span className="st-eyebrow">{m.dashboard.products.category}</span>
          <select name="category" defaultValue={initialCategory}>
            <option value="">{m.storefront.popularRentals.browseAll}</option>
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <button className="st-filter-go" type="submit">
        {m.storefront.hero.checkAvailability}
      </button>
    </form>
  );
}
