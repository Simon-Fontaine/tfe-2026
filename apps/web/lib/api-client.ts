"use server";

import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// ─── Types ──────────────────────────────────────────────────────────────────

type ApiSuccess<T> = { data: T };
type ApiMutationSuccess = { success: true };
type ApiError = { error: string; fieldErrors?: Partial<Record<string, string[]>> };
type ApiResponse<T> = ApiSuccess<T> | ApiError;
type ApiMutationResponse = ApiMutationSuccess | ApiError;

// ─── Cookie forwarding ─────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
	const cookieStore = await cookies();
	return { cookie: cookieStore.toString() };
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
	const headers = await authHeaders();
	const res = await fetch(`${API_URL}${path}`, {
		headers,
		cache: "no-store",
	});

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		return { error: body?.error ?? `Request failed (${res.status})` };
	}

	return res.json();
}

// ─── POST / PATCH / DELETE with JSON body ───────────────────────────────────

export async function apiPost<T = unknown>(
	path: string,
	body?: Record<string, unknown>
): Promise<(ApiMutationSuccess & T) | ApiError> {
	return apiMutate("POST", path, body);
}

export async function apiPatch(
	path: string,
	body?: Record<string, unknown>
): Promise<ApiMutationResponse> {
	return apiMutate("PATCH", path, body);
}

export async function apiDelete(
	path: string,
	body?: Record<string, unknown>
): Promise<ApiMutationResponse> {
	return apiMutate("DELETE", path, body);
}

async function apiMutate<T = unknown>(
	method: string,
	path: string,
	body?: Record<string, unknown>
): Promise<(ApiMutationSuccess & T) | ApiError> {
	const headers = await authHeaders();
	const res = await fetch(`${API_URL}${path}`, {
		method,
		headers: { ...headers, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});

	const json = await res.json().catch(() => null);

	if (!res.ok) {
		if (json?.fieldErrors)
			return { error: json.error ?? "Validation failed.", fieldErrors: json.fieldErrors };
		return { error: json?.error ?? `Request failed (${res.status})` };
	}

	return json;
}

// ─── FormData proxy (for file uploads) ──────────────────────────────────────

export async function apiPostFormData<T = unknown>(
	path: string,
	formData: FormData
): Promise<(ApiMutationSuccess & T) | ApiError> {
	const headers = await authHeaders();
	const res = await fetch(`${API_URL}${path}`, {
		method: "POST",
		headers,
		body: formData,
	});

	const json = await res.json().catch(() => null);

	if (!res.ok) {
		return { error: json?.error ?? `Upload failed (${res.status})` };
	}

	return json;
}

export async function apiDeleteRaw(path: string): Promise<ApiMutationResponse> {
	const headers = await authHeaders();
	const res = await fetch(`${API_URL}${path}`, {
		method: "DELETE",
		headers,
	});

	const json = await res.json().catch(() => null);

	if (!res.ok) {
		return { error: json?.error ?? `Request failed (${res.status})` };
	}

	return json;
}
