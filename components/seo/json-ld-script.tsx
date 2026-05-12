export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  // Escape </script> sequences to prevent breaking out of the script tag
  const safe = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
