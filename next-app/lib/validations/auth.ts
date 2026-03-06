import * as v from "valibot";

// ─── Password constants ────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_LONG_LENGTH = 14;

// ─── Regex ───────────────────────────────────────────────────────────────────

const RE_LOWERCASE = /[a-z]/;
const RE_UPPERCASE = /[A-Z]/;
const RE_NUMBER = /[0-9]/;
const RE_SPECIAL = /[^a-zA-Z0-9]/;

// ─── Password strength ───────────────────────────────────────────────────────

export interface PasswordChecks {
	hasMinLength: boolean;
	hasLowercase: boolean;
	hasUppercase: boolean;
	hasNumber: boolean;
	hasSpecialChar: boolean;
	hasLongLength: boolean;
}

export type PasswordStrength = "weak" | "fair" | "strong" | "very-strong";

export interface PasswordStrengthResult {
	score: number;
	strength: PasswordStrength;
	checks: PasswordChecks;
}

const SCORE_TIERS: Array<[min: number, score: number, strength: PasswordStrength]> = [
	[5, 4, "very-strong"],
	[4, 3, "strong"],
	[3, 2, "fair"],
	[1, 1, "weak"],
	[0, 0, "weak"],
];

export function getPasswordStrength(password: string): PasswordStrengthResult {
	const checks: PasswordChecks = {
		hasMinLength: password.length >= PASSWORD_MIN_LENGTH,
		hasLowercase: RE_LOWERCASE.test(password),
		hasUppercase: RE_UPPERCASE.test(password),
		hasNumber: RE_NUMBER.test(password),
		hasSpecialChar: RE_SPECIAL.test(password),
		hasLongLength: password.length >= PASSWORD_LONG_LENGTH,
	};

	const rawScore = [
		checks.hasMinLength,
		checks.hasLowercase,
		checks.hasUppercase,
		checks.hasNumber,
		checks.hasSpecialChar,
		checks.hasLongLength,
	].filter(Boolean).length;

	const [, score, strength] = SCORE_TIERS.find(([min]) => rawScore >= min) ?? [0, 0, "weak"];

	return { score, strength, checks };
}

// ─── Shared pipes ────────────────────────────────────────────────────────────

const passwordComplexityPipe = v.pipe(
	v.string(),
	v.nonEmpty("Password is required"),
	v.minLength(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters"),
	v.maxLength(PASSWORD_MAX_LENGTH, "Password must be at most 128 characters"),
	v.regex(RE_LOWERCASE, "Password must contain at least one lowercase letter"),
	v.regex(RE_UPPERCASE, "Password must contain at least one uppercase letter"),
	v.regex(RE_NUMBER, "Password must contain at least one number"),
	v.regex(RE_SPECIAL, "Password must contain at least one special character")
);

// ─── Login ───────────────────────────────────────────────────────────────────

export const LoginSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Email is required"),
		v.email("Invalid email address"),
		v.maxLength(255, "Email must be at most 255 characters")
	),
	password: v.pipe(
		v.string(),
		v.nonEmpty("Password is required"),
		v.maxLength(PASSWORD_MAX_LENGTH, "Password must be at most 128 characters")
	),
});

export type LoginInput = v.InferOutput<typeof LoginSchema>;

// ─── Register ────────────────────────────────────────────────────────────────

export const RegisterSchema = v.pipe(
	v.object({
		email: v.pipe(
			v.string(),
			v.trim(),
			v.nonEmpty("Email is required"),
			v.email("Invalid email address"),
			v.maxLength(255, "Email must be at most 255 characters")
		),
		username: v.pipe(
			v.string(),
			v.trim(),
			v.nonEmpty("Username is required"),
			v.minLength(3, "Username must be at least 3 characters"),
			v.maxLength(20, "Username must be at most 20 characters"),
			v.regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
		),
		// Server defaults to username
		displayName: v.optional(
			v.pipe(
				v.string(),
				v.trim(),
				v.minLength(1, "Display name cannot be empty"),
				v.maxLength(50, "Display name must be at most 50 characters")
			)
		),
		password: passwordComplexityPipe,
		confirmPassword: v.pipe(v.string(), v.nonEmpty("Please confirm your password")),
	}),
	// Attach mismatch error
	v.forward(
		v.check((input) => input.password === input.confirmPassword, "Passwords do not match"),
		["confirmPassword"]
	)
);

export type RegisterInput = v.InferOutput<typeof RegisterSchema>;

// ─── Forgot Password ─────────────────────────────────────────────────────────

export const ForgotPasswordSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Email is required"),
		v.email("Invalid email address"),
		v.maxLength(255, "Email must be at most 255 characters")
	),
});

export type ForgotPasswordInput = v.InferOutput<typeof ForgotPasswordSchema>;

// ─── Verify Code ─────────────────────────────────────────────────────────────

export const VerifyCodeSchema = v.object({
	code: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Verification code is required"),
		v.length(6, "Code must be exactly 6 digits"),
		v.regex(/^\d{6}$/, "Code must contain only digits")
	),
});

export type VerifyCodeInput = v.InferOutput<typeof VerifyCodeSchema>;

// ─── Reset Password ──────────────────────────────────────────────────────────

export const ResetPasswordSchema = v.pipe(
	v.object({
		password: passwordComplexityPipe,
		confirmPassword: v.pipe(v.string(), v.nonEmpty("Please confirm your password")),
	}),
	v.forward(
		v.check((input) => input.password === input.confirmPassword, "Passwords do not match"),
		["confirmPassword"]
	)
);

export type ResetPasswordInput = v.InferOutput<typeof ResetPasswordSchema>;

// ─── Change Password ─────────────────────────────────────────────────────────

export const ChangePasswordSchema = v.pipe(
	v.object({
		currentPassword: v.pipe(
			v.string(),
			v.nonEmpty("Current password is required"),
			v.maxLength(PASSWORD_MAX_LENGTH, "Password must be at most 128 characters")
		),
		newPassword: passwordComplexityPipe,
		confirmNewPassword: v.pipe(v.string(), v.nonEmpty("Please confirm your new password")),
	}),
	v.forward(
		v.check((input) => input.newPassword === input.confirmNewPassword, "Passwords do not match"),
		["confirmNewPassword"]
	)
);

export type ChangePasswordInput = v.InferOutput<typeof ChangePasswordSchema>;

// ─── Recovery Code ───────────────────────────────────────────────────────────

export const RecoveryCodeSchema = v.object({
	code: v.pipe(v.string(), v.trim(), v.nonEmpty("Recovery code is required")),
});

export type RecoveryCodeInput = v.InferOutput<typeof RecoveryCodeSchema>;

// ─── Credential Name ─────────────────────────────────────────────────────────

export const CredentialNameSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Name is required"),
		v.maxLength(100, "Name must be at most 100 characters")
	),
});

export type CredentialNameInput = v.InferOutput<typeof CredentialNameSchema>;
