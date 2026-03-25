import type { Transport } from "../transport";
import type { SdkResult } from "../types";

export type AuthActionResult = {
	success?: true;
	nextStep?: string;
	email?: string;
	next?: string;
	twoFactorMethods?: {
		totp: boolean;
		passkey: boolean;
		securityKey: boolean;
		passkeyCredentialIds?: string[];
		securityKeyCredentialIds?: string[];
	};
	newRecoveryCode?: string;
	redirect?: string;
};

export type LoginInput = { email: string; password: string; next?: string };
export type RegisterInput = {
	email: string;
	username: string;
	displayName?: string;
	password: string;
	confirmPassword: string;
};
export type TwoFactorInput = { code: string; next?: string };

export class AuthService {
	constructor(private readonly transport: Transport) {}

	login(input: LoginInput): Promise<SdkResult<AuthActionResult>> {
		return this.transport.post<AuthActionResult>("/api/auth/login", input);
	}

	register(input: RegisterInput): Promise<SdkResult<AuthActionResult>> {
		return this.transport.post<AuthActionResult>("/api/auth/register", input);
	}

	verifyTotp(input: TwoFactorInput): Promise<SdkResult<AuthActionResult>> {
		return this.transport.post<AuthActionResult>("/api/auth/2fa/totp", input);
	}

	verifyRecoveryCode(input: TwoFactorInput): Promise<SdkResult<AuthActionResult>> {
		return this.transport.post<AuthActionResult>("/api/auth/2fa/recovery", input);
	}

	checkUsername(username: string): Promise<SdkResult<{ available: boolean }>> {
		return this.transport.get<{ available: boolean }>(
			`/api/auth/register/check-username?username=${encodeURIComponent(username.trim())}`
		);
	}
}
