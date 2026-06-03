import path from "node:path";
import type { NextConfig } from "next";
import { requiredEnv } from "./lib/env";

function parseRemotePattern(
	envUrl: string
): { protocol: "http" | "https"; hostname: string; port?: string; pathname: string } | null {
	try {
		const parsed = new URL(envUrl);
		const entry: { protocol: "http" | "https"; hostname: string; port?: string; pathname: string } =
			{
				protocol: parsed.protocol.replace(":", "") as "http" | "https",
				hostname: parsed.hostname,
				pathname: "/**",
			};
		if (parsed.port) entry.port = parsed.port;
		return entry;
	} catch {
		return null;
	}
}

const apiUrl = requiredEnv("API_URL");
const s3Pattern = parseRemotePattern(requiredEnv("S3_ENDPOINT"));
const s3PublicPattern = parseRemotePattern(requiredEnv("S3_PUBLIC_URL"));

// Include S3_PUBLIC_URL as a separate pattern only when it resolves to a different host
// (e.g., a CDN in production). In dev both vars point to the same MinIO instance.
const s3Patterns = [
	...(s3Pattern ? [s3Pattern] : []),
	...(s3PublicPattern && s3PublicPattern.hostname !== s3Pattern?.hostname ? [s3PublicPattern] : []),
];

const nextConfig: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: path.resolve(__dirname, "../.."),
	turbopack: {
		root: path.resolve(__dirname, "../.."),
	},
	images: {
		remotePatterns: [
			{
				hostname: "images.unsplash.com",
			},
			...s3Patterns,
		],
	},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
				],
			},
		];
	},
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${apiUrl}/api/:path*`,
			},
		];
	},
};

export default nextConfig;
