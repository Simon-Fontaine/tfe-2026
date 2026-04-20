import { Hono } from "hono";

import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { getPublicRecruitmentListingById, getPublicRecruitmentListings } from "@/utils/recruit";

const publicRecruitmentListingsRoutes = new Hono<AuthEnv>();

publicRecruitmentListingsRoutes.use("*", optionalAuth);

publicRecruitmentListingsRoutes.get("/", async (c) => {
	const user = c.get("user");
	const category = c.req.query("category") as "lft" | "lfp" | "lfr" | "lfs" | undefined;
	const memberType = c.req.query("memberType") as "player" | "staff" | undefined;
	const region = c.req.query("region") as string | undefined;

	return c.json({
		data: await getPublicRecruitmentListings({ category, memberType, region }, user?.id ?? null),
	});
});

publicRecruitmentListingsRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const listing = await getPublicRecruitmentListingById(c.req.param("id"), user?.id ?? null);
	if (!listing) return c.json({ error: "Listing not found." }, 404);
	return c.json({ data: listing });
});

export { publicRecruitmentListingsRoutes };
