import { createAppSdk } from "@scrimflow/app-sdk";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

async function getCookieHeader() {
	const cookieStore = await cookies();
	return { cookie: cookieStore.toString() };
}

async function forwardSetCookieHeaders(response: Response): Promise<void> {
	const setCookieHeaders = response.headers.getSetCookie();
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
			else if (lower.startsWith("expires=")) {
				opts.expires = new Date(part.split("=").slice(1).join("="));
			}
		}

		cookieStore.set(name, value, opts);
	}
}

export function getServerSdk() {
	return createAppSdk({
		baseUrl: API_URL,
		auth: {
			getAuthHeaders: getCookieHeader,
			onResponse: forwardSetCookieHeaders,
		},
	});
}
