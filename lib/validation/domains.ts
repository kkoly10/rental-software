import { z } from "zod";

export const updateSlugSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(63, "Slug must be at most 63 characters")
    .regex(
      /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/,
      "Slug must be lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen."
    ),
});

export const customDomainSchema = z.object({
  domain: z
    .string()
    .min(4, "Domain is too short")
    .max(253, "Domain is too long")
    .regex(
      /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
      "Enter a valid domain (e.g., example.com)"
    )
    .transform((v) => v.toLowerCase()),
});
