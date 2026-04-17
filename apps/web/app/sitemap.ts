import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

	return [
		{ url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
		{ url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
		{ url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
		{ url: `${baseUrl}/recruiting`, changeFrequency: "daily", priority: 0.8 },
		{ url: `${baseUrl}/players`, changeFrequency: "daily", priority: 0.7 },
		{ url: `${baseUrl}/teams`, changeFrequency: "daily", priority: 0.7 },
		{ url: `${baseUrl}/orgs`, changeFrequency: "daily", priority: 0.7 },
		{ url: `${baseUrl}/privacy`, changeFrequency: "monthly", priority: 0.3 },
		{ url: `${baseUrl}/terms`, changeFrequency: "monthly", priority: 0.3 },
	];
}
