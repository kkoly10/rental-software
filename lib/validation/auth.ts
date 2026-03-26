import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(320, "Email must be 320 characters or fewer.");

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(25, "Phone number must be 25 characters or fewer.")
  .refine(
    (value) => value.length === 0 || /^[0-9+().\-\s]{7,25}$/.test(value),
    "Enter a valid phone number."
  )
  .transform((value) => value || undefined);

const optionalNameSchema = z
  .string()
  .trim()
  .max(100, "Full name must be 100 characters or fewer.")
  .transform((value) => value || undefined);

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(72, "Password must be 72 characters or fewer."),
  redirect: z.string().trim().optional(),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
  fullName: optionalNameSchema,
  phone: optionalPhoneSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your new password.")
      .max(72, "Password must be 72 characters or fewer."),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
