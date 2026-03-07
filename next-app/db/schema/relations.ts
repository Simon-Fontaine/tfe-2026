import { relations } from "drizzle-orm";
import {
	accountDeletionRequestTable,
	auditLogTable,
	availabilityTable,
	chatChannelMemberTable,
	chatChannelTable,
	chatMessageTable,
	emailChangeVerificationTable,
	heroTable,
	lfgApplicationTable,
	lfgPostTable,
	mapTable,
	notificationTable,
	ocrJobTable,
	organizationMemberTable,
	organizationTable,
	playerHeroTable,
	playerMapTable,
	playerProfileTable,
	scrimConfirmationTable,
	scrimMapTable,
	scrimPlayerStatTable,
	scrimTable,
	sensitiveActionVerificationTable,
	sessionTable,
	srHistoryTable,
	teamRosterTable,
	teamTable,
	userDeviceTable,
	userTable,
} from "./index";

// ============================================================================

export const userRelations = relations(userTable, ({ one, many }) => ({
	profile: one(playerProfileTable, {
		fields: [userTable.id],
		references: [playerProfileTable.userId],
	}),
	sessions: many(sessionTable),
	devices: many(userDeviceTable),
	auditLogs: many(auditLogTable),
	organizationMemberships: many(organizationMemberTable),
	teamRosters: many(teamRosterTable),
	availabilities: many(availabilityTable),
	notifications: many(notificationTable),
	lfgPosts: many(lfgPostTable),
	lfgApplications: many(lfgApplicationTable),
	chatChannelMemberships: many(chatChannelMemberTable),
	chatMessages: many(chatMessageTable),
	emailChangeVerifications: many(emailChangeVerificationTable),
	accountDeletionRequests: many(accountDeletionRequestTable),
	sensitiveActionVerifications: many(sensitiveActionVerificationTable),
	heroPool: many(playerHeroTable),
	preferredMaps: many(playerMapTable),
}));

export const sessionRelations = relations(sessionTable, ({ one }) => ({
	user: one(userTable, {
		fields: [sessionTable.userId],
		references: [userTable.id],
	}),
	device: one(userDeviceTable, {
		fields: [sessionTable.deviceId],
		references: [userDeviceTable.id],
	}),
}));

export const playerProfileRelations = relations(playerProfileTable, ({ one }) => ({
	user: one(userTable, {
		fields: [playerProfileTable.userId],
		references: [userTable.id],
	}),
}));

export const organizationRelations = relations(organizationTable, ({ one, many }) => ({
	owner: one(userTable, {
		fields: [organizationTable.ownerId],
		references: [userTable.id],
	}),
	members: many(organizationMemberTable),
	teams: many(teamTable),
}));

export const organizationMemberRelations = relations(organizationMemberTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [organizationMemberTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [organizationMemberTable.userId],
		references: [userTable.id],
	}),
}));

export const teamRelations = relations(teamTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [teamTable.organizationId],
		references: [organizationTable.id],
	}),
	roster: many(teamRosterTable),
	homeScrims: many(scrimTable, { relationName: "homeTeamScrims" }),
	awayScrims: many(scrimTable, { relationName: "awayTeamScrims" }),
	confirmations: many(scrimConfirmationTable),
	lfgPosts: many(lfgPostTable),
	chatChannels: many(chatChannelTable, { relationName: "teamChatChannels" }),
}));

export const teamRosterRelations = relations(teamRosterTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [teamRosterTable.teamId],
		references: [teamTable.id],
	}),
	user: one(userTable, {
		fields: [teamRosterTable.userId],
		references: [userTable.id],
	}),
}));

export const lfgPostRelations = relations(lfgPostTable, ({ one, many }) => ({
	user: one(userTable, {
		fields: [lfgPostTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [lfgPostTable.teamId],
		references: [teamTable.id],
	}),
	applications: many(lfgApplicationTable),
}));

export const lfgApplicationRelations = relations(lfgApplicationTable, ({ one, many }) => ({
	post: one(lfgPostTable, {
		fields: [lfgApplicationTable.postId],
		references: [lfgPostTable.id],
	}),
	applicant: one(userTable, {
		fields: [lfgApplicationTable.applicantUserId],
		references: [userTable.id],
	}),
	applicantTeam: one(teamTable, {
		fields: [lfgApplicationTable.applicantTeamId],
		references: [teamTable.id],
	}),
	chatChannels: many(chatChannelTable, { relationName: "recruitmentChatChannels" }),
}));

export const availabilityRelations = relations(availabilityTable, ({ one }) => ({
	user: one(userTable, {
		fields: [availabilityTable.userId],
		references: [userTable.id],
	}),
}));

export const scrimRelations = relations(scrimTable, ({ one, many }) => ({
	homeTeam: one(teamTable, {
		fields: [scrimTable.homeTeamId],
		references: [teamTable.id],
		relationName: "homeTeamScrims",
	}),
	awayTeam: one(teamTable, {
		fields: [scrimTable.awayTeamId],
		references: [teamTable.id],
		relationName: "awayTeamScrims",
	}),
	createdBy: one(userTable, {
		fields: [scrimTable.createdByUserId],
		references: [userTable.id],
	}),
	maps: many(scrimMapTable),
	confirmations: many(scrimConfirmationTable),
	ocrJobs: many(ocrJobTable),
	srHistory: many(srHistoryTable),
	chatChannels: many(chatChannelTable, { relationName: "scrimChatChannels" }),
}));

export const scrimConfirmationRelations = relations(scrimConfirmationTable, ({ one }) => ({
	scrim: one(scrimTable, {
		fields: [scrimConfirmationTable.scrimId],
		references: [scrimTable.id],
	}),
	team: one(teamTable, {
		fields: [scrimConfirmationTable.teamId],
		references: [teamTable.id],
	}),
	confirmedBy: one(userTable, {
		fields: [scrimConfirmationTable.confirmedByUserId],
		references: [userTable.id],
	}),
}));

export const scrimMapRelations = relations(scrimMapTable, ({ one, many }) => ({
	scrim: one(scrimTable, {
		fields: [scrimMapTable.scrimId],
		references: [scrimTable.id],
	}),
	ocrJob: one(ocrJobTable, {
		fields: [scrimMapTable.ocrJobId],
		references: [ocrJobTable.id],
	}),
	playerStats: many(scrimPlayerStatTable),
}));

export const scrimPlayerStatRelations = relations(scrimPlayerStatTable, ({ one }) => ({
	scrimMap: one(scrimMapTable, {
		fields: [scrimPlayerStatTable.scrimMapId],
		references: [scrimMapTable.id],
	}),
	user: one(userTable, {
		fields: [scrimPlayerStatTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [scrimPlayerStatTable.teamId],
		references: [teamTable.id],
	}),
}));

export const srHistoryRelations = relations(srHistoryTable, ({ one }) => ({
	scrim: one(scrimTable, {
		fields: [srHistoryTable.scrimId],
		references: [scrimTable.id],
	}),
}));

export const ocrJobRelations = relations(ocrJobTable, ({ one, many }) => ({
	scrim: one(scrimTable, {
		fields: [ocrJobTable.scrimId],
		references: [scrimTable.id],
	}),
	submittedBy: one(userTable, {
		fields: [ocrJobTable.submittedByUserId],
		references: [userTable.id],
	}),
	extractedMaps: many(scrimMapTable),
}));

export const notificationRelations = relations(notificationTable, ({ one }) => ({
	user: one(userTable, {
		fields: [notificationTable.userId],
		references: [userTable.id],
	}),
}));

// ---- Chat relations ----

export const chatChannelRelations = relations(chatChannelTable, ({ one, many }) => ({
	scrim: one(scrimTable, {
		fields: [chatChannelTable.scrimId],
		references: [scrimTable.id],
		relationName: "scrimChatChannels",
	}),
	team: one(teamTable, {
		fields: [chatChannelTable.teamId],
		references: [teamTable.id],
		relationName: "teamChatChannels",
	}),
	lfgApplication: one(lfgApplicationTable, {
		fields: [chatChannelTable.lfgApplicationId],
		references: [lfgApplicationTable.id],
		relationName: "recruitmentChatChannels",
	}),
	members: many(chatChannelMemberTable),
	messages: many(chatMessageTable),
}));

export const chatChannelMemberRelations = relations(chatChannelMemberTable, ({ one }) => ({
	channel: one(chatChannelTable, {
		fields: [chatChannelMemberTable.channelId],
		references: [chatChannelTable.id],
	}),
	user: one(userTable, {
		fields: [chatChannelMemberTable.userId],
		references: [userTable.id],
	}),
}));

export const chatMessageRelations = relations(chatMessageTable, ({ one }) => ({
	channel: one(chatChannelTable, {
		fields: [chatMessageTable.channelId],
		references: [chatChannelTable.id],
	}),
	sender: one(userTable, {
		fields: [chatMessageTable.senderId],
		references: [userTable.id],
	}),
	replyTo: one(chatMessageTable, {
		fields: [chatMessageTable.replyToMessageId],
		references: [chatMessageTable.id],
	}),
}));

// ---- Verification relations ----

export const emailChangeVerificationRelations = relations(
	emailChangeVerificationTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [emailChangeVerificationTable.userId],
			references: [userTable.id],
		}),
	})
);

export const accountDeletionRequestRelations = relations(
	accountDeletionRequestTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [accountDeletionRequestTable.userId],
			references: [userTable.id],
		}),
	})
);

export const sensitiveActionVerificationRelations = relations(
	sensitiveActionVerificationTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [sensitiveActionVerificationTable.userId],
			references: [userTable.id],
		}),
	})
);

// ---- Hero / Map registry relations ----

export const heroRelations = relations(heroTable, ({ many }) => ({
	players: many(playerHeroTable),
}));

export const mapRelations = relations(mapTable, ({ many }) => ({
	players: many(playerMapTable),
}));

export const playerHeroRelations = relations(playerHeroTable, ({ one }) => ({
	user: one(userTable, {
		fields: [playerHeroTable.userId],
		references: [userTable.id],
	}),
	hero: one(heroTable, {
		fields: [playerHeroTable.heroId],
		references: [heroTable.id],
	}),
}));

export const playerMapRelations = relations(playerMapTable, ({ one }) => ({
	user: one(userTable, {
		fields: [playerMapTable.userId],
		references: [userTable.id],
	}),
	map: one(mapTable, {
		fields: [playerMapTable.mapId],
		references: [mapTable.id],
	}),
}));

// ---- Device & audit relations ----

export const userDeviceRelations = relations(userDeviceTable, ({ one, many }) => ({
	user: one(userTable, {
		fields: [userDeviceTable.userId],
		references: [userTable.id],
	}),
	sessions: many(sessionTable),
}));

export const auditLogRelations = relations(auditLogTable, ({ one }) => ({
	user: one(userTable, {
		fields: [auditLogTable.userId],
		references: [userTable.id],
	}),
}));
