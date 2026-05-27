import { TEAM_VIEWABLE_STATUSES } from "@scrimflow/shared";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
	chatChannelMemberTable,
	chatChannelTable,
	scrimTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";

function buildTeamChannelName(team: { name: string; tag: string }) {
	return `[${team.tag}] ${team.name} Team Chat`;
}

function buildScrimChannelName(
	kind: "scrim_negotiation" | "scrim_lobby",
	teams: {
		homeTeam: { name: string; tag: string };
		awayTeam: { name: string; tag: string };
	}
) {
	const suffix = kind === "scrim_lobby" ? "Lobby" : "Negotiation";
	return `[${teams.homeTeam.tag}] ${teams.homeTeam.name} vs [${teams.awayTeam.tag}] ${teams.awayTeam.name} ${suffix}`;
}

async function listActiveRosterUserIds(teamId: string) {
	const members = await db.query.teamRosterTable.findMany({
		where: and(
			eq(teamRosterTable.teamId, teamId),
			inArray(teamRosterTable.status, TEAM_VIEWABLE_STATUSES)
		),
		columns: { userId: true },
	});
	return [...new Set(members.map((member) => member.userId))];
}

async function listTeamAdminUserIds(teamId: string) {
	const members = await db.query.teamRosterTable.findMany({
		where: and(
			eq(teamRosterTable.teamId, teamId),
			inArray(teamRosterTable.status, TEAM_VIEWABLE_STATUSES),
			eq(teamRosterTable.permissionRole, "admin")
		),
		columns: { userId: true },
	});
	return [...new Set(members.map((member) => member.userId))];
}

async function syncChannelMembers(params: {
	channelId: string;
	userIds: string[];
	mode: "append" | "sync";
}) {
	const nextUserIds = [...new Set(params.userIds)];
	const existingMembers = await db.query.chatChannelMemberTable.findMany({
		where: eq(chatChannelMemberTable.channelId, params.channelId),
		columns: { id: true, userId: true, leftAt: true },
	});

	const existingByUserId = new Map(existingMembers.map((member) => [member.userId, member]));
	const missingUserIds = nextUserIds.filter((userId) => !existingByUserId.has(userId));

	if (missingUserIds.length > 0) {
		await db
			.insert(chatChannelMemberTable)
			.values(
				missingUserIds.map((userId) => ({
					channelId: params.channelId,
					userId,
				}))
			)
			.onConflictDoNothing();
	}

	const rejoinIds = nextUserIds
		.map((userId) => existingByUserId.get(userId))
		.filter((member): member is NonNullable<typeof member> => !!member && member.leftAt !== null)
		.map((member) => member.id);

	if (rejoinIds.length > 0) {
		await db
			.update(chatChannelMemberTable)
			.set({ leftAt: null })
			.where(inArray(chatChannelMemberTable.id, rejoinIds));
	}

	if (params.mode === "sync") {
		const staleIds = existingMembers
			.filter((member) => member.leftAt === null && !nextUserIds.includes(member.userId))
			.map((member) => member.id);

		if (staleIds.length > 0) {
			await db
				.update(chatChannelMemberTable)
				.set({ leftAt: new Date() })
				.where(inArray(chatChannelMemberTable.id, staleIds));
		}
	}
}

async function setChannelArchivedState(channelId: string, isArchived: boolean, name?: string) {
	await db
		.update(chatChannelTable)
		.set({
			isArchived,
			...(name ? { name } : {}),
		})
		.where(eq(chatChannelTable.id, channelId));
}

export async function ensureTeamConversation(teamId: string) {
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { id: true, name: true, tag: true },
	});
	if (!team) return null;

	const existing = await db.query.chatChannelTable.findFirst({
		where: and(eq(chatChannelTable.channelType, "team"), eq(chatChannelTable.teamId, team.id)),
		columns: { id: true, name: true, isArchived: true },
	});

	const channelName = buildTeamChannelName(team);
	let channelId = existing?.id ?? null;

	if (!existing) {
		const [channel] = await db
			.insert(chatChannelTable)
			.values({
				channelType: "team",
				name: channelName,
				teamId: team.id,
			})
			.returning({ id: chatChannelTable.id });
		channelId = channel.id;
	} else if (existing.name !== channelName || existing.isArchived) {
		await setChannelArchivedState(existing.id, false, channelName);
	}

	if (!channelId) return null;

	const memberUserIds = await listActiveRosterUserIds(team.id);
	await syncChannelMembers({
		channelId,
		userIds: memberUserIds,
		mode: "sync",
	});

	return channelId;
}

async function getScrimConversationContext(scrimId: string) {
	return db.query.scrimTable.findFirst({
		where: eq(scrimTable.id, scrimId),
		columns: {
			id: true,
			status: true,
			homeTeamId: true,
			awayTeamId: true,
		},
		with: {
			homeTeam: {
				columns: { id: true, name: true, tag: true },
			},
			awayTeam: {
				columns: { id: true, name: true, tag: true },
			},
		},
	});
}

async function ensureScrimConversation(params: {
	scrimId: string;
	channelType: "scrim_negotiation" | "scrim_lobby";
	channelName: string;
	memberUserIds: string[];
	isArchived: boolean;
}) {
	const existing = await db.query.chatChannelTable.findFirst({
		where: and(
			eq(chatChannelTable.scrimId, params.scrimId),
			eq(chatChannelTable.channelType, params.channelType)
		),
		columns: { id: true, name: true, isArchived: true },
	});

	let channelId = existing?.id ?? null;

	if (!existing) {
		const [channel] = await db
			.insert(chatChannelTable)
			.values({
				channelType: params.channelType,
				name: params.channelName,
				scrimId: params.scrimId,
				isArchived: params.isArchived,
			})
			.returning({ id: chatChannelTable.id });
		channelId = channel.id;
	} else if (existing.name !== params.channelName || existing.isArchived !== params.isArchived) {
		await setChannelArchivedState(existing.id, params.isArchived, params.channelName);
	}

	if (!channelId) return null;

	await syncChannelMembers({
		channelId,
		userIds: params.memberUserIds,
		mode: params.channelType === "scrim_lobby" ? "append" : "sync",
	});

	return channelId;
}

async function archiveScrimConversation(
	scrimId: string,
	channelType: "scrim_negotiation" | "scrim_lobby"
) {
	await db
		.update(chatChannelTable)
		.set({ isArchived: true })
		.where(
			and(eq(chatChannelTable.scrimId, scrimId), eq(chatChannelTable.channelType, channelType))
		);
}

export async function ensureScrimConversationLifecycle(scrimId: string) {
	const scrim = await getScrimConversationContext(scrimId);
	if (!scrim) return null;
	if (!scrim.awayTeamId || !scrim.awayTeam) return scrim;

	if (scrim.status === "pending") {
		const managerIds = [
			...(await listTeamAdminUserIds(scrim.homeTeamId)),
			...(await listTeamAdminUserIds(scrim.awayTeamId)),
		];
		await ensureScrimConversation({
			scrimId,
			channelType: "scrim_negotiation",
			channelName: buildScrimChannelName("scrim_negotiation", {
				homeTeam: scrim.homeTeam,
				awayTeam: scrim.awayTeam,
			}),
			memberUserIds: managerIds,
			isArchived: false,
		});
		return scrim;
	}

	const rosterUserIds = [
		...(await listActiveRosterUserIds(scrim.homeTeamId)),
		...(await listActiveRosterUserIds(scrim.awayTeamId)),
	];
	await ensureScrimConversation({
		scrimId,
		channelType: "scrim_lobby",
		channelName: buildScrimChannelName("scrim_lobby", {
			homeTeam: scrim.homeTeam,
			awayTeam: scrim.awayTeam,
		}),
		memberUserIds: rosterUserIds,
		isArchived: scrim.status === "cancelled" || scrim.status === "completed",
	});
	await archiveScrimConversation(scrimId, "scrim_negotiation");

	if (scrim.status === "cancelled") {
		await archiveScrimConversation(scrimId, "scrim_lobby");
	}

	return scrim;
}
