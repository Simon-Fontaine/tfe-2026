import type { SdkClientConfig, SdkError, SdkResult } from "./types";

const API_UNAVAILABLE_MESSAGE = "Unable to reach the API server.";

export class Transport {
	private readonly baseUrl: string;
	private readonly fetchFn: typeof fetch;
	private readonly auth: SdkClientConfig["auth"];

	constructor(config: SdkClientConfig) {
		this.baseUrl = config.baseUrl;
		this.fetchFn = config.fetchFn ?? fetch;
		this.auth = config.auth;
	}

	async get<T>(path: string): Promise<SdkResult<T>> {
		return this.request<T>(path, { cache: "no-store" });
	}

	async post<T>(path: string, body?: Record<string, unknown>): Promise<SdkResult<T>> {
		return this.request<T>(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		});
	}

	async patch<T>(path: string, body?: Record<string, unknown>): Promise<SdkResult<T>> {
		return this.request<T>(path, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		});
	}

	async delete<T>(path: string, body?: Record<string, unknown>): Promise<SdkResult<T>> {
		return this.request<T>(path, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		});
	}

	private async request<T>(path: string, init: RequestInit): Promise<SdkResult<T>> {
		const authHeaders = (await this.auth?.getAuthHeaders?.()) ?? {};
		const headers = {
			...(init.headers ?? {}),
			...authHeaders,
		};

		let response: Response;
		try {
			response = await this.fetchFn(`${this.baseUrl}${path}`, {
				...init,
				headers,
			});
		} catch {
			return { ok: false, error: { message: API_UNAVAILABLE_MESSAGE } };
		}

		await this.auth?.onResponse?.(response);

		const json = await response.json().catch(() => null);
		if (!response.ok) {
			return { ok: false, error: normalizeError(response.status, json) };
		}

		return { ok: true, data: json as T };
	}
}

function normalizeError(status: number, body: unknown): SdkError {
	const payload = isObject(body) ? body : {};
	const message =
		typeof payload.error === "string" && payload.error.length > 0
			? payload.error
			: `Request failed (${status})`;

	return {
		message,
		status,
		fieldErrors: isFieldErrors(payload.fieldErrors) ? payload.fieldErrors : undefined,
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isFieldErrors(value: unknown): value is Partial<Record<string, string[]>> {
	if (!isObject(value)) return false;
	return Object.values(value).every(
		(entry) => Array.isArray(entry) && entry.every((msg) => typeof msg === "string")
	);
}
