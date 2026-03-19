import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge route protection.
 * Fast cookie presence check only; deep DB validation happens in Server Components.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/teams", "/scrims"];
const AUTH_PATH = "/auth";

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
	if (!isProtected) return NextResponse.next();

	const hasToken = request.cookies.has("session_token");
	if (hasToken) return NextResponse.next();

	// Preserve destination for post-login redirect
	const loginUrl = new URL(AUTH_PATH, request.url);
	loginUrl.searchParams.set("next", pathname);
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: [
		// Skip Next.js internals and static assets
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
