type CatalogFilterFormProps = {
  initialDate?: string;
  initialZip?: string;
  initialCategory?: string;
};

const categories = [
  { value: "", label: "All categories" },
  { value: "bounce-houses", label: "Bounce Houses" },
  { value: "water-slides", label: "Water Slides" },
  { value: "obstacle-courses", label: "Obstacle Courses" },
  { value: "packages", label: "Packages" },
  { value: "add-ons", label: "Add-ons" },
] as const;

export function CatalogFilterForm({
  initialDate = "",
  initialZip = "",
  initialCategory = "",
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

        <label className="storefront-field">
          <span>Category</span>
          <select name="category" defaultValue={initialCategory}>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <button className="primary-btn storefront-search-btn" type="submit">
          Update Results
        </button>
      </div>
    </form>
  );
}
