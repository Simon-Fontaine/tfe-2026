"use server";

import { apiRoutes } from "@scrimflow/shared";
import { apiAuthPost } from "@/lib/api-client";

interface TotpSetupResult {
	error?: string;
	success?: boolean;
}

interface TotpSecretResult {
	error?: string;
	secret?: string;
	uri?: string;
}

export async function generateTotpSecretAction(): Promise<TotpSetupResult & TotpSecretResult> {
	const res = await apiAuthPost<{ secret: string; uri: string }>(apiRoutes.auth.totp.generate);
	if ("error" in res) return { error: res.error };
	return { secret: res.secret, uri: res.uri };
}

export async function verifyAndEnableTotpAction(
	secret: string,
	code: string
): Promise<TotpSetupResult & { recoveryCode?: string }> {
	const res = await apiAuthPost<{ recoveryCode?: string }>(apiRoutes.auth.totp.enable, {
		secret,
		code,
	});
	if ("error" in res) return { error: res.error };
	return { success: true, ...(res.recoveryCode ? { recoveryCode: res.recoveryCode } : {}) };
}
