"use server";

import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// ─── Types ──────────────────────────────────────────────────────────────────

type ApiSuccess<T> = { data: T };
type ApiMutationSuccess = { success: true };
type ApiError = { error: string; status?: number; fieldErrors?: Partial<Record<string, string[]>> };
type ApiResponse<T> = ApiSuccess<T> | ApiError;
type ApiMutationResponse = ApiMutationSuccess | ApiError;

const API_UNAVAILABLE_ERROR = "Unable to reach the API server.";

// ─── Cookie forwarding ─────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
	const cookieStore = await cookies();
	return { cookie: cookieStore.toString() };
}

function isApiError(value: Response | ApiError): value is ApiError {
	return "error" in value;
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response | ApiError> {
	try {
		return await fetch(`${API_URL}${path}`, init);
	} catch {
		return { error: API_UNAVAILABLE_ERROR };
	}
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		headers,
		cache: "no-store",
	});
	if (isApiError(res)) return res;

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		return { error: body?.error ?? `Request failed (${res.status})`, status: res.status };
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
	const res = await fetchApi(path, {
		method,
		headers: { ...headers, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (isApiError(res)) return res;

	const json = await res.json().catch(() => null);

	if (!res.ok) {
		if (json?.fieldErrors)
			return { error: json.error ?? "Validation failed.", fieldErrors: json.fieldErrors };
		return { error: json?.error ?? `Request failed (${res.status})` };
	}

	return json;
}

// ─── Auth mutations (forwards Set-Cookie from API to browser) ───────────────

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
	body?: Record<string, unknown>
): Promise<(ApiMutationSuccess & T) | ApiError> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		method: "POST",
		headers: { ...headers, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (isApiError(res)) return res;

	await forwardSetCookieHeaders(res);

	const json = await res.json().catch(() => null);

	if (!res.ok) {
		if (json?.fieldErrors)
			return { error: json.error ?? "Validation failed.", fieldErrors: json.fieldErrors };
		return { error: json?.error ?? `Request failed (${res.status})` };
	}

	return json;
}

export async function apiAuthDelete<T = unknown>(
	path: string,
	body?: Record<string, unknown>
): Promise<(ApiMutationSuccess & T) | ApiError> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		method: "DELETE",
		headers: { ...headers, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (isApiError(res)) return res;

	await forwardSetCookieHeaders(res);

	const json = await res.json().catch(() => null);

	if (!res.ok) {
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
	const res = await fetchApi(path, {
		method: "POST",
		headers,
		body: formData,
	});
	if (isApiError(res)) return res;

	const json = await res.json().catch(() => null);

	if (!res.ok) {
		return { error: json?.error ?? `Upload failed (${res.status})` };
	}

	return json;
}

export async function apiDeleteRaw(path: string): Promise<ApiMutationResponse> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		method: "DELETE",
		headers,
	});
	if (isApiError(res)) return res;

	const json = await res.json().catch(() => null);

	if (!res.ok) {
		return { error: json?.error ?? `Request failed (${res.status})` };
	}

	return json;
}
