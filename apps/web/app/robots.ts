import { appRoutes } from "@scrimflow/shared";
import type { MetadataRoute } from "next";
import { requiredEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = requiredEnv("NEXT_PUBLIC_APP_URL");

	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/api/", "/app/", "/auth", "/onboarding", appRoutes.deletionPending],
		},
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
