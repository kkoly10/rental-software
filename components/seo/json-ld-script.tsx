export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  // Neutralize sequences that can break out of an inline <script> block:
  // </script>, <!-- and the JS line separators U+2028/U+2029 (valid in JSON
  // strings but treated as line terminators by the HTML/JS parser).
  const safe = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
