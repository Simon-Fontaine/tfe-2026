import { Hono } from "hono";

import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { getPublicRecruitmentListingById, getPublicRecruitmentListings } from "@/utils/recruit";

const publicRecruitmentListingsRoutes = new Hono<AuthEnv>();

publicRecruitmentListingsRoutes.use("*", optionalAuth);

const VALID_ROLES = ["tank", "damage", "support"] as const;
const VALID_RANKS = [
	"bronze",
	"silver",
	"gold",
	"platinum",
	"diamond",
	"master",
	"grandmaster",
	"champion",
] as const;
const MAX_REGION_LENGTH = 50;

publicRecruitmentListingsRoutes.get("/", async (c) => {
	const user = c.get("user");
	const category = c.req.query("category") as "lft" | "lfp" | "lfr" | "lfs" | undefined;
	const memberType = c.req.query("memberType") as "player" | "staff" | undefined;
	const regionRaw = c.req.query("region");
	if (regionRaw && regionRaw.trim().length > MAX_REGION_LENGTH) {
		return c.json({ error: "region parameter exceeds maximum length." }, 400);
	}
	const region = regionRaw?.trim() || undefined;
	const roleRaw = c.req.query("role");
	const role = (VALID_ROLES as readonly string[]).includes(roleRaw ?? "")
		? (roleRaw as "tank" | "damage" | "support")
		: undefined;
	const rankFilterRaw = c.req.query("rankFilter");
	const rankFilter = (VALID_RANKS as readonly string[]).includes(rankFilterRaw ?? "")
		? rankFilterRaw
		: undefined;

	return c.json({
		data: await getPublicRecruitmentListings(
			{ category, memberType, region, role, rankFilter },
			user?.id ?? null
		),
	});
});

publicRecruitmentListingsRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const listing = await getPublicRecruitmentListingById(c.req.param("id"), user?.id ?? null);
	if (!listing) return c.json({ error: "Listing not found." }, 404);
	return c.json({ data: listing });
});

export { publicRecruitmentListingsRoutes };
