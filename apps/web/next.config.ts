import path from "node:path";
import type { NextConfig } from "next";

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
		],
	},
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${process.env.API_URL ?? "http://localhost:3001"}/api/:path*`,
			},
		];
	},
};

export default nextConfig;
