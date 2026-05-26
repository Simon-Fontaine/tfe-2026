import { Hono } from "hono";
import type { AuthEnv } from "@/middleware/auth";
import { getRecruitmentConversationsForUser } from "@/utils/recruit";

const recruitmentConversationsRoutes = new Hono<AuthEnv>();

recruitmentConversationsRoutes.get("/", async (c) => {
	const user = c.get("user");
	const conversations = await getRecruitmentConversationsForUser(user.id);
	return c.json({ data: conversations });
});

export { recruitmentConversationsRoutes };
