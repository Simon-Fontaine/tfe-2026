/**
 * Best-effort geolocation with fail-open empty GeoData.
 */

import logger from "./logger";
import redis from "./redis";

export interface GeoData {
	/** ISO 3166-1 alpha-2 */
	country: string | null;
	city: string | null;
	/** Stored as string to avoid float precision loss. */
	lat: string | null;
	lon: string | null;
}

const EMPTY_GEO: GeoData = { country: null, city: null, lat: null, lon: null };

/** Placeholder for private/loopback IPs. */
const LOCAL_GEO: GeoData = { country: "BE", city: "Brussels", lat: "50.8503", lon: "4.3517" };

const GEO_TIMEOUT_MS = 3_000;
const GEO_CACHE_TTL_SECONDS = 86_400; // 24 hours

/** Match loopback, private IPs, and IPv4-mapped IPv6. */
function isPrivateIp(ip: string): boolean {
	const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
	return (
		normalized === "127.0.0.1" ||
		normalized === "::1" ||
		/^10\./.test(normalized) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
		/^192\.168\./.test(normalized) ||
		normalized === "localhost"
	);
}

// ─── Cache layer ───────────────────────────────────────────────────────────────

function cacheKey(ip: string): string {
	return `geo:${ip}`;
}

async function getCached(ip: string): Promise<GeoData | null> {
	if (!redis) return null;
	try {
		const raw = await redis.get(cacheKey(ip));
		if (!raw) return null;
		return JSON.parse(raw) as GeoData;
	} catch (err) {
		logger.warn({ err }, "geo cache read error");
		return null;
	}
}

async function setCache(ip: string, geo: GeoData): Promise<void> {
	if (!redis) return;
	try {
		await redis.set(cacheKey(ip), JSON.stringify(geo), "EX", GEO_CACHE_TTL_SECONDS);
	} catch (err) {
		logger.warn({ err }, "geo cache write error");
	}
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function fetchGeoData(ip: string | null): Promise<GeoData> {
	if (!ip || isPrivateIp(ip)) return LOCAL_GEO;

	const cached = await getCached(ip);
	if (cached) return cached;

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

		const res = await fetch(
			`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,city,lat,lon`,
			{ signal: controller.signal, cache: "no-store" }
		);

		clearTimeout(timer);

		if (!res.ok) return EMPTY_GEO;

		const data = (await res.json()) as Record<string, unknown>;
		if (data.status !== "success") return EMPTY_GEO;

		const geo: GeoData = {
			country: typeof data.countryCode === "string" ? data.countryCode : null,
			city: typeof data.city === "string" ? data.city : null,
			lat: data.lat != null ? String(data.lat) : null,
			lon: data.lon != null ? String(data.lon) : null,
		};

		// Fire-and-forget cache write
		setCache(ip, geo);

		return geo;
	} catch {
		// Fail open on any error
		return EMPTY_GEO;
	}
}

/** Formats GeoData for email display. */
export function formatLocation(geo: GeoData): string {
	const parts = [geo.city, geo.country].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : "Unknown location";
}
