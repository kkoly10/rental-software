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
    (value) => value.length === 0 || phoneRegex.test(value),
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
    (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Enter a valid date."
  )
  .transform((value) => value || undefined);

export function moneySchema(label: string, options?: { min?: number; max?: number }) {
  const min = options?.min ?? 0;
  const max = options?.max ?? 100000;

  return z.coerce
    .number({ invalid_type_error: `${label} must be a valid number.` })
    .finite(`${label} must be a valid number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be ${max} or less.`)
    .transform((value) => Number(value.toFixed(2)));
}
