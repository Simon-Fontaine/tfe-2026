"use server";

import { redirect } from "next/navigation";
import { apiAuthPost } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";

interface VerifyResult {
	error?: string;
}

export async function createWebAuthnChallengeAction(): Promise<string> {
	const res = await apiAuthPost<{ challenge: string }>(apiRoutes.auth.webauthn.challenge);
	if ("error" in res) throw new Error(res.error);
	return res.challenge;
}

export async function verifyPasskey2faAction(
	encodedData: string,
	next?: string
): Promise<VerifyResult> {
	const data = JSON.parse(encodedData);
	const res = await apiAuthPost<{ redirect?: string }>(apiRoutes.auth.webauthn.passkey.verify, {
		...data,
		next,
	});
	if ("error" in res) return { error: res.error };
	redirect(res.redirect ?? appRoutes.root);
}

export async function verifySecurityKey2faAction(
	encodedData: string,
	next?: string
): Promise<VerifyResult> {
	const data = JSON.parse(encodedData);
	const res = await apiAuthPost<{ redirect?: string }>(apiRoutes.auth.webauthn.securityKey.verify, {
		...data,
		next,
	});
	if ("error" in res) return { error: res.error };
	redirect(res.redirect ?? appRoutes.root);
}

export async function loginWithPasskeyAction(
	encodedData: string,
	next?: string
): Promise<VerifyResult> {
	const data = JSON.parse(encodedData);
	const res = await apiAuthPost<{ redirect?: string }>(apiRoutes.auth.webauthn.passkey.login, {
		...data,
		next,
	});
	if ("error" in res) return { error: res.error };
	redirect(res.redirect ?? appRoutes.root);
}
