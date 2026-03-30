import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/api/", "/dashboard/", "/auth", "/onboarding", "/deletion-pending"],
		},
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
