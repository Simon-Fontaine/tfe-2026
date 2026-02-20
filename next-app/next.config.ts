import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	turbopack: {
		root: path.join(__dirname, "."),
	},
	images: {
		remotePatterns: [
			{
				hostname: "images.unsplash.com",
			},
		],
	},
};

export default nextConfig;
