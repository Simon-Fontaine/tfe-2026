import { SendRecruitmentMessageSchema } from "@scrimflow/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { chatChannelMemberTable, chatMessageTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { getRecruitmentConversationsForUser, getRecruitmentThreadForUser } from "@/utils/recruit";

const threadsRoutes = new Hono<AuthEnv>();

threadsRoutes.get("/", async (c) => {
	const user = c.get("user");
	return c.json({ data: await getRecruitmentConversationsForUser(user.id) });
});

threadsRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const thread = await getRecruitmentThreadForUser(c.req.param("id"), user.id);
	if (!thread) return c.json({ error: "Conversation not found." }, 404);
	return c.json({ data: thread });
});

threadsRoutes.post("/:id/messages", async (c) => {
	const user = c.get("user");
	const threadId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(SendRecruitmentMessageSchema, { ...body, threadId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const membership = await db.query.chatChannelMemberTable.findFirst({
		where: and(
			eq(chatChannelMemberTable.channelId, threadId),
			eq(chatChannelMemberTable.userId, user.id)
		),
		columns: { id: true, leftAt: true },
	});
	if (!membership || membership.leftAt) {
		return c.json({ error: "You do not have access to this conversation." }, 403);
	}

	await db.insert(chatMessageTable).values({
		channelId: threadId,
		senderId: user.id,
		content: parsed.output.content,
	});

	return c.json({ success: true });
});

export { threadsRoutes };
