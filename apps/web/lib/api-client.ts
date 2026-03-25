"use server";

import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// ─── Types ──────────────────────────────────────────────────────────────────

type ApiSuccess<T> = { data: T };
type ApiMutationSuccess = { success: true };
type ApiError = { error: string; status: number; fieldErrors?: Partial<Record<string, string[]>> };
type ApiResponse<T> = ApiSuccess<T> | ApiError;
type ApiMutationResponse = ApiMutationSuccess | ApiError;

type FetchApiInit = RequestInit & {
	timeoutMs?: number;
};

const API_UNAVAILABLE_ERROR = "Unable to reach the API server.";
const API_TIMEOUT_ERROR = "The request to the API timed out.";
const API_ABORTED_ERROR = "The request was canceled.";

// ─── Cookie forwarding ─────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
	const cookieStore = await cookies();
	return { cookie: cookieStore.toString() };
}

function isApiError(value: Response | ApiError): value is ApiError {
	return "error" in value;
}

async function readJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
	return res.json().catch(() => null);
}

function normalizeApiError(params: {
	status: number;
	body: Record<string, unknown> | null;
	fallbackMessage: string;
}): ApiError {
	const { status, body, fallbackMessage } = params;
	const fieldErrors = body?.fieldErrors;

	return {
		error: typeof body?.error === "string" ? body.error : fallbackMessage,
		status,
		...(fieldErrors && typeof fieldErrors === "object"
			? { fieldErrors: fieldErrors as Partial<Record<string, string[]>> }
			: {}),
	};
}

async function fetchApi(path: string, init?: FetchApiInit): Promise<Response | ApiError> {
	const { timeoutMs, signal, ...requestInit } = init ?? {};
	const timeoutController = timeoutMs ? new AbortController() : null;
	const cleanup: Array<() => void> = [];

	if (!signal && !timeoutController) {
		try {
			return await fetch(`${API_URL}${path}`, requestInit);
		} catch {
			return { error: API_UNAVAILABLE_ERROR, status: 503 };
		}
	}

	const compositeController = new AbortController();
	const onAbort = () => compositeController.abort();
	if (signal) {
		if (signal.aborted) compositeController.abort();
		signal.addEventListener("abort", onAbort);
		cleanup.push(() => signal.removeEventListener("abort", onAbort));
	}
	if (timeoutController) {
		timeoutController.signal.addEventListener("abort", onAbort);
		cleanup.push(() => timeoutController.signal.removeEventListener("abort", onAbort));
	}

	const timeoutId =
		timeoutMs && timeoutController
			? setTimeout(() => {
					timeoutController.abort();
				}, timeoutMs)
			: null;
	if (timeoutId) cleanup.push(() => clearTimeout(timeoutId));

	try {
		return await fetch(`${API_URL}${path}`, { ...requestInit, signal: compositeController.signal });
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			if (timeoutController?.signal.aborted) return { error: API_TIMEOUT_ERROR, status: 408 };
			return { error: API_ABORTED_ERROR, status: 499 };
		}
		return { error: API_UNAVAILABLE_ERROR, status: 503 };
	} finally {
		for (const fn of cleanup) fn();
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
		const body = await readJsonSafe(res);
		return normalizeApiError({
			status: res.status,
			body,
			fallbackMessage: `Request failed (${res.status})`,
		});
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

	const json = await readJsonSafe(res);

	if (!res.ok) {
		return normalizeApiError({
			status: res.status,
			body: json,
			fallbackMessage: `Upload failed (${res.status})`,
		});
	}

	return json as ApiMutationSuccess & T;
}

export async function apiDeleteRaw(path: string): Promise<ApiMutationResponse> {
	const headers = await authHeaders();
	const res = await fetchApi(path, {
		method: "DELETE",
		headers,
	});
	if (isApiError(res)) return res;

	const json = await readJsonSafe(res);

	if (!res.ok) {
		return normalizeApiError({
			status: res.status,
			body: json,
			fallbackMessage: `Request failed (${res.status})`,
		});
	}

	return json as ApiMutationSuccess;
}
