import { appRoutes } from "@scrimflow/shared";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge route protection.
 * Fast cookie presence check only; deep DB validation happens in Server Components.
 */

const PROTECTED_PREFIXES = ["/app", "/onboarding", appRoutes.deletionPending];
const AUTH_PATH = "/auth";
const MAX_NEXT_DESTINATION_LENGTH = 2048;

function isSafeRelativePath(value: string) {
	return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function matchesPathPrefix(pathname: string, prefix: string) {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	const isProtected = PROTECTED_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
	if (!isProtected) return NextResponse.next();

	const hasToken = request.cookies.has("session_token");
	if (hasToken) {
		const requestHeaders = new Headers(request.headers);
		const destination = `${pathname}${search}`;
		if (destination.length <= MAX_NEXT_DESTINATION_LENGTH && isSafeRelativePath(destination)) {
			requestHeaders.set("x-scrimflow-path", destination);
		}
		return NextResponse.next({ request: { headers: requestHeaders } });
	}

	// Preserve destination for post-login redirect.
	// Only forward a next destination that is a same-origin relative path.
	// Reject protocol-relative paths (//host/...) to prevent open redirect.
	const loginUrl = new URL(AUTH_PATH, request.url);
	const destination = `${pathname}${search}`;
	const fallbackPath =
		pathname.length <= MAX_NEXT_DESTINATION_LENGTH && isSafeRelativePath(pathname)
			? pathname
			: appRoutes.root;
	const safePath =
		destination.length <= MAX_NEXT_DESTINATION_LENGTH && isSafeRelativePath(destination)
			? destination
			: fallbackPath;
	loginUrl.searchParams.set("next", safePath);
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: [
		// Skip Next.js internals and static assets
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
