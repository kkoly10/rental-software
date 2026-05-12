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

export function CatalogFilterForm({
  initialDate = "",
  initialZip = "",
  initialCategory = "",
  categories = [],
}: CatalogFilterFormProps) {
  return (
    <form action="/inventory" className="storefront-filter-shell">
      <div className="storefront-filter-grid">
        <label className="storefront-field">
          <span>Event Date</span>
          <input name="date" type="date" defaultValue={initialDate} />
        </label>

        <label className="storefront-field">
          <span>Delivery ZIP</span>
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
            <span>Category</span>
            <select name="category" defaultValue={initialCategory}>
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button className="primary-btn storefront-search-btn" type="submit">
          Update Results
        </button>
      </div>
    </form>
  );
}
