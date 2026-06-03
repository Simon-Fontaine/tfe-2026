"use server";

import type { PermissionDenialReason } from "@scrimflow/shared";
import { cookies, headers } from "next/headers";
import { requiredEnv } from "@/lib/env";

const API_URL = requiredEnv("API_URL");

type ApiSuccess<T> = { data: T };
type ApiMutationSuccess = { success: true };
type ApiError = {
	error: string;
	status: number;
	reason?: PermissionDenialReason;
	fieldErrors?: Partial<Record<string, string[]>>;
};
type ApiResponse<T> = ApiSuccess<T> | ApiError;
type ApiMutationResponse = ApiMutationSuccess | ApiError;

async function authHeaders(): Promise<Record<string, string>> {
	const cookieStore = await cookies();
	const incomingHeaders = await headers();
	const forwardedHeaders: Record<string, string> = { cookie: cookieStore.toString() };

	for (const name of [
		"user-agent",
		"cf-connecting-ip",
		"x-forwarded-for",
		"x-real-ip",
		"x-forwarded-proto",
		"x-forwarded-host",
	] as const) {
		const value = incomingHeaders.get(name);
		if (value) forwardedHeaders[name] = value;
	}

	return forwardedHeaders;
}

async function readJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
	return res.json().catch(() => null);
}

const VALID_DENIAL_REASONS: ReadonlyArray<string> = [
	"role",
	"lifecycle",
	"ownership",
	"verification",
	"privacy",
	"settlement-lock",
	"moderation",
];

function normalizeApiError(params: {
	status: number;
	body: Record<string, unknown> | null;
	fallbackMessage: string;
}): ApiError {
	const { status, body, fallbackMessage } = params;
	const fieldErrors = body?.fieldErrors;
	const reason =
		typeof body?.reason === "string" && VALID_DENIAL_REASONS.includes(body.reason)
			? (body.reason as PermissionDenialReason)
			: undefined;

	return {
		error: typeof body?.error === "string" ? body.error : fallbackMessage,
		status,
		...(reason && { reason }),
		...(fieldErrors && typeof fieldErrors === "object"
			? { fieldErrors: fieldErrors as Partial<Record<string, string[]>> }
			: {}),
	};
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
	return fetch(`${API_URL}${path}`, init);
}

export async function apiGet<T>(
	path: string,
	options?: { cache?: RequestCache; revalidate?: number }
): Promise<ApiResponse<T>> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		headers,
		cache: options?.cache ?? "no-store",
		...(options?.revalidate !== undefined && { next: { revalidate: options.revalidate } }),
	});

	if (!res.ok) {
		const body = await readJsonSafe(res);
		return normalizeApiError({
			status: res.status,
			body,
			fallbackMessage: `Request failed (${res.status})`,
		});
	}

	return res.json();
}

export async function apiPost<T = unknown>(
	path: string,
	body?: object
): Promise<(ApiMutationSuccess & T) | ApiError> {
	return apiMutate("POST", path, body);
}

export async function apiPatch(path: string, body?: object): Promise<ApiMutationResponse> {
	return apiMutate("PATCH", path, body);
}

export async function apiDelete<T = unknown>(
	path: string,
	body?: object
): Promise<(ApiMutationSuccess & T) | ApiError> {
	return apiMutate("DELETE", path, body);
}

async function apiMutate<T = unknown>(
	method: string,
	path: string,
	body?: object
): Promise<(ApiMutationSuccess & T) | ApiError> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		method,
		headers: { ...headers, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});

	const json = await readJsonSafe(res);

	if (!res.ok) {
		return normalizeApiError({
			status: res.status,
			body: json,
			fallbackMessage: `Request failed (${res.status})`,
		});
	}

	return json as ApiMutationSuccess & T;
}

async function forwardSetCookieHeaders(res: Response): Promise<void> {
	const setCookieHeaders = res.headers.getSetCookie();
	if (setCookieHeaders.length === 0) return;

	const cookieStore = await cookies();
	for (const header of setCookieHeaders) {
		const parts = header.split(";").map((s) => s.trim());
		const [nameValue] = parts;
		const eqIdx = nameValue.indexOf("=");
		if (eqIdx === -1) continue;
		const name = nameValue.slice(0, eqIdx).trim();
		const value = nameValue.slice(eqIdx + 1).trim();

		const opts: Record<string, unknown> = { path: "/" };
		for (const part of parts.slice(1)) {
			const lower = part.toLowerCase();
			if (lower === "httponly") opts.httpOnly = true;
			else if (lower === "secure") opts.secure = true;
			else if (lower.startsWith("samesite=")) opts.sameSite = lower.split("=")[1];
			else if (lower.startsWith("max-age=")) opts.maxAge = Number(lower.split("=")[1]);
			else if (lower.startsWith("path=")) opts.path = part.split("=")[1];
			else if (lower.startsWith("expires="))
				opts.expires = new Date(part.split("=").slice(1).join("="));
		}
		cookieStore.set(name, value, opts);
	}
}

export async function apiAuthPost<T = unknown>(
	path: string,
	body?: object
): Promise<(ApiMutationSuccess & T) | ApiError> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		method: "POST",
		headers: { ...headers, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});

	await forwardSetCookieHeaders(res);

	const json = await readJsonSafe(res);

	if (!res.ok) {
		return normalizeApiError({
			status: res.status,
			body: json,
			fallbackMessage: `Request failed (${res.status})`,
		});
	}

	return json as ApiMutationSuccess & T;
}
