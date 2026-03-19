"use client";

import { decodeBase64, encodeBase64 } from "@oslojs/encoding";
import { createWebAuthnChallengeAction } from "@/app/(auth)/auth/webauthn-actions";

export async function createChallenge(): Promise<Uint8Array> {
	const encoded = await createWebAuthnChallengeAction();
	return decodeBase64(encoded);
}

export async function authenticate2fa(credentialIds?: string[]): Promise<string> {
	const challenge = await createChallenge();

	const options: PublicKeyCredentialRequestOptions = {
		challenge: challenge.buffer as ArrayBuffer,
		rpId: window.location.hostname,
		allowCredentials: credentialIds?.map((id) => {
			const decoded = decodeBase64(id);
			return { id: decoded.buffer as ArrayBuffer, type: "public-key" as const };
		}),
		userVerification: "preferred",
		timeout: 60_000,
	};

	const result = (await navigator.credentials.get({
		publicKey: options,
	})) as PublicKeyCredential | null;

	if (!result) throw new Error("WebAuthn authentication was cancelled.");

	const response = result.response as AuthenticatorAssertionResponse;

	return JSON.stringify({
		credentialId: encodeBase64(new Uint8Array(result.rawId)),
		authenticatorData: encodeBase64(new Uint8Array(response.authenticatorData)),
		clientDataJSON: encodeBase64(new Uint8Array(response.clientDataJSON)),
		signature: encodeBase64(new Uint8Array(response.signature)),
	});
}

/**
 * Runs a discoverable WebAuthn ceremony for "Sign in with passkey".
 */
export async function authenticateDiscoverable(): Promise<string> {
	const challenge = await createChallenge();

	const options: PublicKeyCredentialRequestOptions = {
		challenge: challenge.buffer as ArrayBuffer,
		rpId: window.location.hostname,
		userVerification: "required",
		timeout: 60_000,
	};

	const result = (await navigator.credentials.get({
		publicKey: options,
	})) as PublicKeyCredential | null;

	if (!result) throw new Error("WebAuthn authentication was cancelled.");

	const response = result.response as AuthenticatorAssertionResponse;

	return JSON.stringify({
		credentialId: encodeBase64(new Uint8Array(result.rawId)),
		authenticatorData: encodeBase64(new Uint8Array(response.authenticatorData)),
		clientDataJSON: encodeBase64(new Uint8Array(response.clientDataJSON)),
		signature: encodeBase64(new Uint8Array(response.signature)),
		userHandle: response.userHandle ? encodeBase64(new Uint8Array(response.userHandle)) : null,
	});
}

export interface RegisterCredentialParams {
	userId: string;
	userName: string;
	userDisplayName: string;
}

async function registerCredential(
	params: RegisterCredentialParams,
	authenticatorAttachment: AuthenticatorAttachment,
	residentKey: ResidentKeyRequirement,
	userVerification: UserVerificationRequirement
): Promise<string> {
	const challenge = await createChallenge();

	const options: PublicKeyCredentialCreationOptions = {
		rp: { name: "Scrimflow", id: window.location.hostname },
		user: {
			id: new TextEncoder().encode(params.userId),
			name: params.userName,
			displayName: params.userDisplayName || params.userName,
		},
		challenge: challenge.buffer as ArrayBuffer,
		pubKeyCredParams: [
			{ type: "public-key", alg: -7 },
			{ type: "public-key", alg: -257 },
		],
		authenticatorSelection: {
			authenticatorAttachment,
			residentKey,
			userVerification,
		},
		timeout: 120_000,
		attestation: "none",
	};

	const result = (await navigator.credentials.create({
		publicKey: options,
	})) as PublicKeyCredential | null;

	if (!result) throw new Error("WebAuthn registration was cancelled.");

	const response = result.response as AuthenticatorAttestationResponse;

	return JSON.stringify({
		credentialId: encodeBase64(new Uint8Array(result.rawId)),
		attestationObject: encodeBase64(new Uint8Array(response.attestationObject)),
		clientDataJSON: encodeBase64(new Uint8Array(response.clientDataJSON)),
	});
}

export async function registerPasskey(params: RegisterCredentialParams): Promise<string> {
	return registerCredential(params, "platform", "required", "required");
}

export async function registerSecurityKey(params: RegisterCredentialParams): Promise<string> {
	return registerCredential(params, "cross-platform", "discouraged", "discouraged");
}
