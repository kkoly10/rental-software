import { z } from "zod";

const controlCharsRegex = /[\u0000-\u001F\u007F]/g;
const personNameRegex = /^[\p{L}0-9 ,.'-]+$/u;
const phoneRegex = /^[0-9+().\-\s]{7,25}$/;
const postalCodeRegex = /^[A-Za-z0-9\-\s]{3,20}$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const uuidSchema = z.string().uuid("Invalid identifier.");

export function sanitizePlainText(value: string) {
  return value.replace(controlCharsRegex, "").trim();
}

export function requiredText(label: string, maxLength: number) {
  return z
    .string()
    .transform((value) => sanitizePlainText(value))
    .refine((value) => value.length > 0, `${label} is required.`)
    .refine(
      (value) => value.length <= maxLength,
      `${label} must be ${maxLength} characters or fewer.`
    );
}

/**
 * Name is misleading: this accepts an empty string and transforms it
 * to `undefined`, but the inner `z.string()` still rejects an actual
 * `undefined` input with the bare Zod default "Required" message.
 *
 * Callers must either always pass a string (e.g. `String(formData.get("x") ?? "")`)
 * or wrap the field with `.optional()` at the schema layer when the
 * reader can hand back `undefined`. See lib/products/actions.ts:101 +
 * lib/validation/products.ts:91 for the failure mode that motivated
 * this warning.
 */
export function optionalText(label: string, maxLength: number) {
  return z
    .string()
    .transform((value) => sanitizePlainText(value))
    .refine(
      (value) => value.length <= maxLength,
      `${label} must be ${maxLength} characters or fewer.`
    )
    .transform((value) => value || undefined);
}

export const personNameSchema = (label: string) =>
  requiredText(label, 80).refine(
    (value) => personNameRegex.test(value),
    `${label} contains invalid characters.`
  );

export const optionalEmailSchema = z
  .string()
  .transform((value) => sanitizePlainText(value).toLowerCase())
  .refine(
    (value) => value.length === 0 || z.string().email().safeParse(value).success,
    "Enter a valid email address."
  )
  .refine(
    (value) => value.length <= 320,
    "Email must be 320 characters or fewer."
  )
  .transform((value) => value || undefined);

export const requiredEmailSchema = z
  .string()
  .transform((value) => sanitizePlainText(value).toLowerCase())
  .refine((value) => value.length > 0, "Email is required.")
  .refine((value) => z.string().email().safeParse(value).success, "Enter a valid email address.")
  .refine((value) => value.length <= 320, "Email must be 320 characters or fewer.");

export const optionalPhoneSchema = z
  .string()
  .transform((value) => sanitizePlainText(value))
  .refine(
    (value) =>
      value.length === 0 ||
      (phoneRegex.test(value) && value.replace(/\D/g, "").length >= 7),
    "Enter a valid phone number."
  )
  .transform((value) => value || undefined);

export const requiredPostalCodeSchema = z
  .string()
  .transform((value) => sanitizePlainText(value))
  .refine((value) => value.length > 0, "Postal code is required.")
  .refine((value) => postalCodeRegex.test(value), "Enter a valid postal code.");

export const optionalSlugSchema = z
  .string()
  .transform((value) => sanitizePlainText(value).toLowerCase())
  .refine(
    (value) => value.length === 0 || slugRegex.test(value),
    "Invalid product identifier."
  )
  .transform((value) => value || undefined);

export const optionalDateSchema = z
  .string()
  .transform((value) => sanitizePlainText(value))
  .refine(
    (value) => {
      if (value.length === 0) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const d = new Date(value + "T00:00:00Z");
      if (isNaN(d.getTime())) return false;
      const [y, m, day] = value.split("-").map(Number);
      return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
    },
    "Enter a valid date."
  )
  .transform((value) => value || undefined);

export function moneySchema(label: string, options?: { min?: number; max?: number }) {
  const min = options?.min ?? 0;
  const max = options?.max ?? 100000;

  return z.preprocess(
    (val) => {
      // Strip currency symbols and thousands separators so "$1,000" parses.
      // A blank field coerces to 0 (forms default money inputs to 0); an
      // unparseable value is passed through to fail with a clear message.
      if (typeof val === "string") {
        const cleaned = val.replace(/[$,\s]/g, "");
        if (cleaned === "") return 0;
        const n = Number(cleaned);
        return Number.isNaN(n) ? val : n;
      }
      return val;
    },
    z
      .number({ invalid_type_error: `${label} must be a valid number.` })
      .finite(`${label} must be a valid number.`)
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} must be ${max} or less.`)
      .transform((value) => Number(value.toFixed(2)))
  );
}
