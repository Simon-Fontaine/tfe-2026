import {
	CreateRecruitmentPostSchema,
	CreateRecruitmentResponseSchema,
	UpdateRecruitmentPostSchema,
} from "@scrimflow/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { chatMessageTable, lfgApplicationTable, lfgPostTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import { getOrgPermissions } from "@/utils/org";
import {
	canManageRecruitmentPost,
	createRecruitmentThread,
	mapRecruitmentPost,
	mapRecruitmentResponse,
} from "@/utils/recruit";
import { getTeamAccessContext } from "@/utils/team";

const postsRoutes = new Hono<AuthEnv>();

function assertPostShape(input: {
	category: "lft" | "lfp" | "lfr" | "lfs";
	ownerType: "player" | "team" | "organization";
	memberType: "player" | "staff";
}) {
	if (input.category === "lft" && input.ownerType !== "player") {
		return "LFT posts must be created by an individual player.";
	}
	if ((input.category === "lfp" || input.category === "lfr") && input.ownerType !== "team") {
		return "LFP and LFR posts must be created on behalf of a team.";
	}
	if (input.category === "lfs" && input.memberType !== "staff") {
		return "LFS posts must target staff roles.";
	}
	if ((input.category === "lfp" || input.category === "lfr") && input.memberType !== "player") {
		return "LFP and LFR posts must target players.";
	}
	return null;
}

async function listPosts(params: {
	viewerId: string | null;
	category?: "lft" | "lfp" | "lfr" | "lfs";
	memberType?: "player" | "staff";
	ownerType?: "player" | "team" | "organization";
	teamId?: string;
	organizationId?: string;
	mine?: boolean;
}) {
	const rows = await db.query.lfgPostTable.findMany({
		where: and(
			params.mine ? undefined : eq(lfgPostTable.status, "open"),
			params.category ? eq(lfgPostTable.type, params.category) : undefined,
			params.memberType ? eq(lfgPostTable.memberType, params.memberType) : undefined,
			params.ownerType ? eq(lfgPostTable.ownerType, params.ownerType) : undefined,
			params.teamId ? eq(lfgPostTable.teamId, params.teamId) : undefined,
			params.organizationId ? eq(lfgPostTable.organizationId, params.organizationId) : undefined
		),
		with: {
			user: { columns: { id: true, displayName: true, avatarUrl: true } },
			organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true, teamSr: true } },
			applications: { columns: { id: true, status: true, applicantUserId: true } },
		},
		orderBy: [desc(lfgPostTable.createdAt)],
		limit: 100,
	});

	if (!params.mine || !params.viewerId) {
		return rows.map((row) => mapRecruitmentPost(row, { viewerId: params.viewerId }));
	}
	const viewerId = params.viewerId;

	const scoped = await Promise.all(
		rows.map(async (row) => {
			const canManage = await canManageRecruitmentPost(row, viewerId);
			return canManage ? mapRecruitmentPost(row, { viewerId, canManage }) : null;
		})
	);

	return scoped.filter((row): row is NonNullable<typeof row> => row !== null);
}

postsRoutes.get("/", async (c) => {
	const user = c.get("user");
	const viewerId = user?.id ?? null;
	const category = c.req.query("category") as "lft" | "lfp" | "lfr" | "lfs" | undefined;
	const memberType = c.req.query("memberType") as "player" | "staff" | undefined;
	const ownerType = c.req.query("ownerType") as "player" | "team" | "organization" | undefined;
	const teamId = c.req.query("teamId");
	const organizationId = c.req.query("organizationId");
	const mine = c.req.query("mine") === "true";

	return c.json({
		data: await listPosts({
			viewerId,
			category,
			memberType,
			ownerType,
			teamId,
			organizationId,
			mine,
		}),
	});
});

postsRoutes.get("/mine", async (c) => {
	const user = c.get("user");
	return c.json({ data: await listPosts({ viewerId: user.id, mine: true }) });
});

postsRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, c.req.param("id")),
		with: {
			user: { columns: { id: true, displayName: true, avatarUrl: true } },
			organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true, teamSr: true } },
			applications: { columns: { id: true, status: true, applicantUserId: true } },
		},
	});
	if (!post) return c.json({ error: "Post not found." }, 404);

	const canManage = await canManageRecruitmentPost(post, user.id);
	return c.json({ data: mapRecruitmentPost(post, { viewerId: user.id, canManage }) });
});

postsRoutes.get("/:id/responses", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("id");

	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, postId),
		columns: {
			id: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
	});
	if (!post) return c.json({ error: "Post not found." }, 404);
	if (!(await canManageRecruitmentPost(post, user.id))) {
		return c.json({ error: "You do not have permission to view responses for this post." }, 403);
	}

	const rows = await db.query.lfgApplicationTable.findMany({
		where: eq(lfgApplicationTable.postId, postId),
		with: {
			post: {
				columns: { id: true, type: true, title: true },
			},
			applicant: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: {
					profile: { columns: { primaryRole: true, rank: true } },
				},
			},
			applicantTeam: { columns: { id: true, name: true, tag: true } },
			applicantOrganization: { columns: { id: true, name: true } },
			chatChannels: { columns: { id: true } },
		},
		orderBy: [desc(lfgApplicationTable.createdAt)],
	});

	return c.json({ data: rows.map((row) => mapRecruitmentResponse(row)) });
});

postsRoutes.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateRecruitmentPostSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const shapeError = assertPostShape(parsed.output);
	if (shapeError) return c.json({ error: shapeError }, 400);

	let teamId: string | null = parsed.output.teamId ?? null;
	let organizationId: string | null = parsed.output.organizationId ?? null;

	if (parsed.output.ownerType === "team") {
		if (!teamId) return c.json({ error: "Team posts require a team ID." }, 400);
		const access = await getTeamAccessContext(teamId, user.id);
		if (!access?.canManageTeam) {
			return c.json({ error: "You do not have permission to post on behalf of this team." }, 403);
		}
		organizationId = access.organizationId;
	}

	if (parsed.output.ownerType === "organization") {
		if (!organizationId)
			return c.json({ error: "Organisation posts require an organisation ID." }, 400);
		const permissions = await getOrgPermissions(organizationId, user.id);
		if (!permissions.canManage) {
			return c.json(
				{ error: "You do not have permission to post on behalf of this organisation." },
				403
			);
		}
		teamId = null;
	}

	if (parsed.output.ownerType === "player") {
		teamId = null;
		organizationId = null;
	}

	const [post] = await db
		.insert(lfgPostTable)
		.values({
			type: parsed.output.category,
			ownerType: parsed.output.ownerType,
			userId: user.id,
			organizationId,
			teamId,
			title: parsed.output.title,
			memberType: parsed.output.memberType,
			staffRole: parsed.output.staffRole ?? null,
			rolesNeeded: parsed.output.gameRoles ?? [],
			minRank: parsed.output.minRank ?? null,
			maxRank: parsed.output.maxRank ?? null,
			minSr: parsed.output.minSr ?? null,
			maxSr: parsed.output.maxSr ?? null,
			description: parsed.output.description ?? null,
			region: parsed.output.region ?? null,
			expiresAt: parsed.output.expiresAt ? new Date(parsed.output.expiresAt) : null,
		})
		.returning({ id: lfgPostTable.id });

	return c.json({ success: true, postId: post.id });
});

postsRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateRecruitmentPostSchema, { ...body, postId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, postId),
		columns: {
			id: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
	});
	if (!post) return c.json({ error: "Post not found." }, 404);

	if (!(await canManageRecruitmentPost(post, user.id))) {
		return c.json({ error: "You do not have permission to edit this post." }, 403);
	}

	await db
		.update(lfgPostTable)
		.set({
			type: parsed.output.category,
			status: parsed.output.status ?? undefined,
			title: parsed.output.title,
			description: parsed.output.description ?? null,
			memberType: parsed.output.memberType,
			staffRole: parsed.output.staffRole ?? null,
			rolesNeeded: parsed.output.gameRoles ?? [],
			minRank: parsed.output.minRank ?? null,
			maxRank: parsed.output.maxRank ?? null,
			minSr: parsed.output.minSr ?? null,
			maxSr: parsed.output.maxSr ?? null,
			region: parsed.output.region ?? null,
			expiresAt: parsed.output.expiresAt ? new Date(parsed.output.expiresAt) : null,
		})
		.where(eq(lfgPostTable.id, postId));

	return c.json({ success: true });
});

postsRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("id");

	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, postId),
		columns: {
			id: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
	});
	if (!post) return c.json({ error: "Post not found." }, 404);
	if (!(await canManageRecruitmentPost(post, user.id))) {
		return c.json({ error: "You do not have permission to delete this post." }, 403);
	}

	await db.delete(lfgPostTable).where(eq(lfgPostTable.id, postId));
	return c.json({ success: true });
});

postsRoutes.post("/:id/responses", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateRecruitmentResponseSchema, { ...body, postId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const post = await db.query.lfgPostTable.findFirst({
		where: eq(lfgPostTable.id, postId),
		columns: {
			id: true,
			type: true,
			title: true,
			status: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
	});
	if (!post) return c.json({ error: "Post not found." }, 404);
	if (post.status !== "open") return c.json({ error: "This post is no longer open." }, 400);
	if (post.userId === user.id)
		return c.json({ error: "You cannot respond to your own post." }, 409);

	let applicantTeamId: string | null = null;
	let applicantOrganizationId: string | null = null;

	if (post.ownerType === "player") {
		if (parsed.output.senderTeamId) {
			const access = await getTeamAccessContext(parsed.output.senderTeamId, user.id);
			if (!access?.canManageTeam) {
				return c.json({ error: "You do not have permission to respond as that team." }, 403);
			}
			applicantTeamId = access.teamId;
			applicantOrganizationId = access.organizationId;
		} else if (parsed.output.senderOrganizationId) {
			const permissions = await getOrgPermissions(parsed.output.senderOrganizationId, user.id);
			if (!permissions.canManage) {
				return c.json(
					{ error: "You do not have permission to respond as that organisation." },
					403
				);
			}
			applicantOrganizationId = parsed.output.senderOrganizationId;
		}
	} else {
		if (parsed.output.senderTeamId || parsed.output.senderOrganizationId) {
			return c.json(
				{ error: "Responses to team and org posts are sent as a player account." },
				400
			);
		}
	}

	const existing = await db.query.lfgApplicationTable.findFirst({
		where: and(
			eq(lfgApplicationTable.postId, postId),
			eq(lfgApplicationTable.applicantUserId, user.id),
			eq(lfgApplicationTable.status, "pending")
		),
		columns: { id: true },
	});
	if (existing) return c.json({ error: "You already have a pending response to this post." }, 409);

	const [response] = await db
		.insert(lfgApplicationTable)
		.values({
			postId,
			applicantUserId: user.id,
			applicantTeamId,
			applicantOrganizationId,
			message: parsed.output.message ?? null,
		})
		.returning({ id: lfgApplicationTable.id });

	const threadId = await createRecruitmentThread({
		responseId: response.id,
		postOwnerUserId: post.userId,
		senderUserId: user.id,
		postTitle: post.title,
	});

	if (parsed.output.message) {
		await db.insert(chatMessageTable).values({
			channelId: threadId,
			senderId: user.id,
			content: parsed.output.message,
		});
	}

	await createNotification({
		userId: post.userId,
		type: "recruitment_application",
		title: `New response on "${post.title}"`,
		body: parsed.output.message ?? undefined,
		referenceType: "lfg_post",
		referenceId: postId,
	});

	return c.json({ success: true, responseId: response.id, threadId });
});

export { postsRoutes };
