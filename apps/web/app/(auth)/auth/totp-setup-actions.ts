"use server";

import { apiAuthDelete, apiAuthPost, apiGet } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TotpSetupResult {
	error?: string;
	success?: boolean;
}

interface TotpSecretResult {
	error?: string;
	secret?: string;
	uri?: string;
}

// ─── Generate TOTP Secret ──────────────────────────────────────────────────────

export async function generateTotpSecretAction(): Promise<TotpSetupResult & TotpSecretResult> {
	const res = await apiAuthPost<{ secret: string; uri: string }>("/api/auth/totp/generate");
	if ("error" in res) return { error: res.error };
	return { secret: res.secret, uri: res.uri };
}

// ─── Verify & Enable TOTP ────────────────────────────────────────────────────

export async function verifyAndEnableTotpAction(
	secret: string,
	code: string
): Promise<TotpSetupResult & { recoveryCode?: string }> {
	const res = await apiAuthPost<{ recoveryCode?: string }>("/api/auth/totp/enable", {
		secret,
		code,
	});
	if ("error" in res) return { error: res.error };
	return { success: true, ...(res.recoveryCode ? { recoveryCode: res.recoveryCode } : {}) };
}

// ─── Disable TOTP ────────────────────────────────────────────────────────────

export async function disableTotpAction(): Promise<TotpSetupResult> {
	const res = await apiAuthDelete("/api/auth/totp");
	if ("error" in res) return { error: res.error };
	return { success: true };
}

// ─── Status ────────────────────────────────────────────────────────────────────

export async function getTotpStatusAction(): Promise<{ enabled: boolean }> {
	const res = await apiGet<{ enabled: boolean }>("/api/auth/totp/status");
	if ("data" in res) return res.data;
	return { enabled: false };
}
