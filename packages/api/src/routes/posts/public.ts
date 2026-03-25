import { Hono } from "hono";

import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { getPublicRecruitmentPosts } from "@/utils/recruit";

const publicPostsRoutes = new Hono<AuthEnv>();

publicPostsRoutes.use("*", optionalAuth);

publicPostsRoutes.get("/", async (c) => {
	const category = c.req.query("category") as "lft" | "lfp" | "lfr" | "lfs" | undefined;
	const memberType = c.req.query("memberType") as "player" | "staff" | undefined;
	const region = c.req.query("region") as string | undefined;

	return c.json({
		data: await getPublicRecruitmentPosts({ category, memberType, region }),
	});
});

export { publicPostsRoutes };
