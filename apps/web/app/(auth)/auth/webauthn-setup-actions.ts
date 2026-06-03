"use server";

import { apiRoutes, appRoutes } from "@scrimflow/shared";
import { revalidatePath } from "next/cache";
import { apiAuthPost, apiGet } from "@/lib/api-client";

interface SetupResult {
	error?: string;
	success?: boolean;
}

export interface CredentialInfo {
	id: string;
	name: string;
	createdAt?: string;
}

export async function registerPasskeyAction(
	encodedData: string,
	name: string
): Promise<SetupResult & { recoveryCode?: string }> {
	const data = JSON.parse(encodedData);
	const res = await apiAuthPost<{ recoveryCode?: string }>(
		apiRoutes.auth.credentials.passkey.register,
		{ ...data, name: name.trim() || "My Passkey" }
	);
	if ("error" in res) return { error: res.error };
	revalidatePath(appRoutes.settings.security);
	return { success: true, ...(res.recoveryCode ? { recoveryCode: res.recoveryCode } : {}) };
}

export async function registerSecurityKeyAction(
	encodedData: string,
	name: string
): Promise<SetupResult & { recoveryCode?: string }> {
	const data = JSON.parse(encodedData);
	const res = await apiAuthPost<{ recoveryCode?: string }>(
		apiRoutes.auth.credentials.securityKey.register,
		{ ...data, name: name.trim() || "My Security Key" }
	);
	if ("error" in res) return { error: res.error };
	revalidatePath(appRoutes.settings.security);
	return { success: true, ...(res.recoveryCode ? { recoveryCode: res.recoveryCode } : {}) };
}

export async function listPasskeysAction(): Promise<CredentialInfo[]> {
	const res = await apiGet<CredentialInfo[]>(apiRoutes.auth.credentials.passkeys);
	if ("data" in res) return res.data;
	return [];
}

export async function listSecurityKeysAction(): Promise<CredentialInfo[]> {
	const res = await apiGet<CredentialInfo[]>(apiRoutes.auth.credentials.securityKeys);
	if ("data" in res) return res.data;
	return [];
}
