import { Hono } from "hono";
import type { AuthEnv } from "@/middleware/auth";
import { decodeCursor } from "@/utils/cursor";
import { getRecruitmentConversationsPage } from "@/utils/recruit";

const CONVERSATIONS_PAGE_SIZE = 25;

const recruitmentConversationsRoutes = new Hono<AuthEnv>();

recruitmentConversationsRoutes.get("/", async (c) => {
	const user = c.get("user");
	const cursorParam = c.req.query("cursor");

	let cursor = null;
	if (cursorParam) {
		try {
			cursor = decodeCursor(cursorParam);
		} catch {
			return c.json({ error: "Invalid cursor." }, 400);
		}
	}

	const result = await getRecruitmentConversationsPage(user.id, {
		cursor,
		limit: CONVERSATIONS_PAGE_SIZE,
	});
	return c.json(result);
});

export { recruitmentConversationsRoutes };
