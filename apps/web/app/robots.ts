import { appRoutes } from "@scrimflow/shared";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/api/", "/app/", "/auth", "/onboarding", appRoutes.deletionPending],
		},
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
