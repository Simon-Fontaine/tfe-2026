import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { and, eq } from "drizzle-orm";
import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { db } from "@/db";
import { sessionTable, userDeviceTable } from "@/db/schema";
import logger from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClientContext {
	/** Originating client IP from trust-ordered proxy headers. */
	ip: string | null;
	userAgent: string | null;
	/** SHA-256 of User-Agent (detects browser/OS changes). */
	fingerprint: string;
	/** Human-readable label for dashboards/alerts. */
	deviceName: string;
	browserName: string | null;
	osName: string | null;
	deviceType: "mobile" | "tablet" | "desktop" | null;
}

// ─── IP extraction ─────────────────────────────────────────────────────────────

/** Resolves client IP handling common proxy headers. */
export function getClientIp(headers: ReadonlyHeaders): string | null {
	const cf = headers.get("cf-connecting-ip");
	if (cf) return cf.trim();

	const xfwd = headers.get("x-forwarded-for");
	if (xfwd) return xfwd.split(",")[0]?.trim() ?? null;

	const real = headers.get("x-real-ip");
	if (real) return real.trim();

	return null;
}

// ─── User-Agent parsing ────────────────────────────────────────────────────────
// Dependency-free regex parser — avoids ua-parser-js for a small common subset.

function parseBrowser(ua: string): string | null {
	if (/Edg\//.test(ua)) return "Edge";
	if (/OPR\/|Opera\//.test(ua)) return "Opera";
	if (/Firefox\//.test(ua)) return "Firefox";
	if (/SamsungBrowser\//.test(ua)) return "Samsung Browser";
	if (/Chrome\//.test(ua)) return "Chrome";
	if (/Safari\//.test(ua)) return "Safari";
	if (/MSIE |Trident\//.test(ua)) return "Internet Explorer";
	return null;
}

function parseOs(ua: string): string | null {
	if (/Windows NT/.test(ua)) return "Windows";
	if (/Android/.test(ua)) return "Android";
	if (/iPhone|iPod/.test(ua)) return "iOS";
	if (/iPad/.test(ua)) return "iPadOS";
	if (/CrOS/.test(ua)) return "ChromeOS";
	if (/Mac OS X/.test(ua)) return "macOS";
	if (/Linux/.test(ua)) return "Linux";
	return null;
}

function parseDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
	if (/iPad|Tablet/.test(ua)) return "tablet";
	if (/Mobile|iPhone|iPod|Android(?!.*Tablet)/.test(ua)) return "mobile";
	return "desktop";
}

// ─── Fingerprinting ────────────────────────────────────────────────────────────

/** Computes User-Agent fingerprint. */
export function computeFingerprint(userAgent: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(userAgent)));
}

// ─── Main context extractor ────────────────────────────────────────────────────

/** Extracts ClientContext once per request to avoid repeated header reads. */
export function extractClientContext(headers: ReadonlyHeaders): ClientContext {
	const ip = getClientIp(headers);
	const userAgent = headers.get("user-agent") ?? null;
	const uaStr = userAgent ?? "";

	const browserName = uaStr ? parseBrowser(uaStr) : null;
	const osName = uaStr ? parseOs(uaStr) : null;
	const deviceType = uaStr ? parseDeviceType(uaStr) : null;

	const nameParts = [browserName, osName ?? deviceType].filter(Boolean);
	const deviceName = nameParts.length > 0 ? nameParts.join(" on ") : "Unknown Device";

	return {
		ip,
		userAgent,
		fingerprint: computeFingerprint(uaStr),
		deviceName,
		browserName,
		osName,
		deviceType,
	};
}

// ─── Device resolution ─────────────────────────────────────────────────────────

export interface DeviceResult {
	deviceId: string;
	isNew: boolean;
}

/** Upserts device record (re-activating triggers alert). */
export async function resolveDevice(
	userId: string,
	fingerprint: string,
	deviceName: string,
	browserName: string | null,
	osName: string | null,
	deviceType: string | null,
	ip: string | null,
	geoCountry: string | null,
	geoCity: string | null
): Promise<DeviceResult> {
	const existing = await db.query.userDeviceTable.findFirst({
		where: and(eq(userDeviceTable.userId, userId), eq(userDeviceTable.fingerprint, fingerprint)),
	});

	if (existing && existing.revokedAt === null) {
		db.update(userDeviceTable)
			.set({ lastSeenAt: new Date() })
			.where(eq(userDeviceTable.id, existing.id))
			.catch((err: unknown) => logger.error({ err }, "device lastSeenAt update failed"));
		return { deviceId: existing.id, isNew: false };
	}

	const [device] = await db
		.insert(userDeviceTable)
		.values({
			userId,
			fingerprint,
			deviceName,
			browserName,
			osName,
			deviceType,
			firstIpAddress: ip,
			firstGeoCountry: geoCountry,
			firstGeoCity: geoCity,
		})
		.onConflictDoUpdate({
			target: [userDeviceTable.userId, userDeviceTable.fingerprint],
			set: { revokedAt: null, lastSeenAt: new Date() },
		})
		.returning({ id: userDeviceTable.id });

	if (!device) throw new Error("Failed to create device record.");
	return { deviceId: device.id, isNew: true };
}

/** Checks if location matches previous log-ins. */
export async function isKnownLocation(userId: string, geoCountry: string | null): Promise<boolean> {
	if (!geoCountry) return false;
	const rows = await db
		.select({ id: sessionTable.id })
		.from(sessionTable)
		.where(and(eq(sessionTable.userId, userId), eq(sessionTable.geoCountry, geoCountry)))
		.limit(1);
	return rows.length > 0;
}
