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

export async function CatalogFilterForm({
  initialDate = "",
  initialZip = "",
  initialCategory = "",
  categories = [],
}: CatalogFilterFormProps) {
  const m = await getMessages();
  return (
    <form action="/inventory" className="storefront-filter-shell">
      <div className="storefront-filter-grid">
        <label className="storefront-field">
          <span>{m.storefront.hero.eventDate}</span>
          <input name="date" type="date" defaultValue={initialDate} />
        </label>

        <label className="storefront-field">
          <span>{m.storefront.hero.deliveryZip}</span>
          <input
            name="zip"
            type="text"
            defaultValue={initialZip}
            placeholder="22554"
            inputMode="numeric"
          />
        </label>

        {categories.length > 0 && (
          <label className="storefront-field">
            <span>{m.dashboard.products.category}</span>
            <select name="category" defaultValue={initialCategory}>
              <option value="">— {m.storefront.popularRentals.browseAll} —</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button className="primary-btn storefront-search-btn" type="submit">
          {m.storefront.hero.checkAvailability}
        </button>
      </div>
    </form>
  );
}
