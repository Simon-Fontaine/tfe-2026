import { create } from "zustand";

// ─── Step definitions ──────────────────────────────────────────────────────────

export type AuthStep =
	| "login"
	| "register"
	| "forgot-password"
	| "forgot-password-sent"
	| "verify-email"
	| "new-device-verification"
	| "two-factor"
	| "recovery-code"
	| "reset-password";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TwoFactorMethods {
	totp: boolean;
	passkey: boolean;
	securityKey: boolean;
	/** WebAuthn allowCredentials list (Base64). */
	passkeyCredentialIds?: string[];
	securityKeyCredentialIds?: string[];
}

// ─── State ───────────────────────────────────────────────────────────────────

interface TransitionOpts {
	email?: string;
	resetToken?: string;
	next?: string;
	twoFactorMethods?: TwoFactorMethods;
}

interface AuthFlowState {
	step: AuthStep;
	/** Carried across flow steps. */
	email: string;
	resetToken: string;
	/** Validated server-side post-login redirect. */
	next: string;
	twoFactorMethods: TwoFactorMethods | null;

	transitionTo: (step: AuthStep, opts?: TransitionOpts) => void;

	goToLogin: () => void;
	goToRegister: () => void;
	goToForgotPassword: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthFlow = create<AuthFlowState>((set) => ({
	step: "login",
	email: "",
	resetToken: "",
	next: "",
	twoFactorMethods: null,

	transitionTo: (step, opts) =>
		set((state) => ({
			step,
			email: opts?.email ?? state.email,
			resetToken: opts?.resetToken ?? state.resetToken,
			next: opts?.next ?? state.next,
			twoFactorMethods: opts?.twoFactorMethods ?? state.twoFactorMethods,
		})),

	goToLogin: () => set({ step: "login", twoFactorMethods: null }),
	goToRegister: () => set({ step: "register" }),
	goToForgotPassword: () => set({ step: "forgot-password" }),
}));
