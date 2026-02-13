import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone", // Required for Docker
	images: {
		remotePatterns: [
			{
				hostname: "images.unsplash.com",
			},
		],
	},
};

export default nextConfig;
