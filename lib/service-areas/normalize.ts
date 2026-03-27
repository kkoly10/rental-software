export function normalizePostalCode(value?: string | null) {
  if (!value) return "";

  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";

  const usZipMatch = trimmed.match(/^(\d{5})(?:-\d{4})?$/);
  if (usZipMatch) {
    return usZipMatch[1];
  }

  return trimmed.replace(/\s+/g, "");
}

export function normalizeCity(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeState(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}
