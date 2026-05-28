import { relations } from "drizzle-orm";
import {
	accountDeletionRequestTable,
	auditLogTable,
	availabilityTable,
	chatChannelMemberTable,
	chatChannelTable,
	chatMessageReadTable,
	chatMessageTable,
	emailChangeVerificationTable,
	heroTable,
	lifecycleWorkflowTable,
	mapTable,
	notificationTable,
	ocrJobTable,
	onboardingDraftTable,
	organizationMemberTable,
	organizationTable,
	orgInviteTable,
	ownershipWorkflowEventTable,
	ownershipWorkflowTable,
	playerHeroTable,
	playerMapTable,
	playerProfileTable,
	recruitmentApplicationTable,
	recruitmentListingTable,
	scrimConfirmationTable,
	scrimMapTable,
	scrimNegotiationRevisionTable,
	scrimPlayerStatTable,
	scrimResultRevisionTable,
	scrimTable,
	sensitiveActionVerificationTable,
	sessionTable,
	teamInviteTable,
	teamRatingEventTable,
	teamRosterTable,
	teamTable,
	updatePostTable,
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
	recruitmentListings: many(recruitmentListingTable),
	updatePosts: many(updatePostTable),
	recruitmentApplications: many(recruitmentApplicationTable),
	chatChannelMemberships: many(chatChannelMemberTable),
	chatMessages: many(chatMessageTable),
	emailChangeVerifications: many(emailChangeVerificationTable),
	accountDeletionRequests: many(accountDeletionRequestTable),
	sensitiveActionVerifications: many(sensitiveActionVerificationTable),
	heroPool: many(playerHeroTable),
	onboardingDraft: one(onboardingDraftTable, {
		fields: [userTable.id],
		references: [onboardingDraftTable.userId],
	}),
	requestedOwnershipWorkflows: many(ownershipWorkflowTable, {
		relationName: "ownershipWorkflowRequester",
	}),
	receivedOwnershipWorkflows: many(ownershipWorkflowTable, {
		relationName: "ownershipWorkflowRecipient",
	}),
	preferredMaps: many(playerMapTable),
	receivedTeamInvites: many(teamInviteTable, { relationName: "inviteeTeamInvites" }),
	sentTeamInvites: many(teamInviteTable, { relationName: "inviterTeamInvites" }),
	receivedOrgInvites: many(orgInviteTable, { relationName: "inviteeOrgInvites" }),
	sentOrgInvites: many(orgInviteTable, { relationName: "inviterOrgInvites" }),
	createdScrims: many(scrimTable, { relationName: "scrimCreatedBy" }),
	resolvedScrimDisputes: many(scrimTable, { relationName: "scrimDisputeResolvedBy" }),
	submittedScrimResultRevisions: many(scrimResultRevisionTable),
	scrimNegotiationRevisions: many(scrimNegotiationRevisionTable),
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

export const onboardingDraftRelations = relations(onboardingDraftTable, ({ one }) => ({
	user: one(userTable, {
		fields: [onboardingDraftTable.userId],
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
	recruitmentListings: many(recruitmentListingTable),
	updatePosts: many(updatePostTable),
	orgInvites: many(orgInviteTable),
	lifecycleWorkflows: many(lifecycleWorkflowTable),
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
	availabilities: many(availabilityTable),
	homeScrims: many(scrimTable, { relationName: "homeTeamScrims" }),
	awayScrims: many(scrimTable, { relationName: "awayTeamScrims" }),
	confirmations: many(scrimConfirmationTable),
	resultRevisions: many(scrimResultRevisionTable),
	scrimNegotiationRevisions: many(scrimNegotiationRevisionTable),
	recruitmentListings: many(recruitmentListingTable),
	updatePosts: many(updatePostTable),
	chatChannels: many(chatChannelTable, { relationName: "teamChatChannels" }),
	invites: many(teamInviteTable),
	ratingEvents: many(teamRatingEventTable),
	lifecycleWorkflows: many(lifecycleWorkflowTable),
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

export const ownershipWorkflowRelations = relations(ownershipWorkflowTable, ({ one, many }) => ({
	requester: one(userTable, {
		fields: [ownershipWorkflowTable.requesterUserId],
		references: [userTable.id],
		relationName: "ownershipWorkflowRequester",
	}),
	currentOwner: one(userTable, {
		fields: [ownershipWorkflowTable.currentOwnerUserId],
		references: [userTable.id],
		relationName: "ownershipWorkflowCurrentOwner",
	}),
	recipient: one(userTable, {
		fields: [ownershipWorkflowTable.recipientUserId],
		references: [userTable.id],
		relationName: "ownershipWorkflowRecipient",
	}),
	recoveryTarget: one(userTable, {
		fields: [ownershipWorkflowTable.recoveryTargetUserId],
		references: [userTable.id],
		relationName: "ownershipWorkflowRecoveryTarget",
	}),
	events: many(ownershipWorkflowEventTable),
}));

export const ownershipWorkflowEventRelations = relations(
	ownershipWorkflowEventTable,
	({ one }) => ({
		workflow: one(ownershipWorkflowTable, {
			fields: [ownershipWorkflowEventTable.workflowId],
			references: [ownershipWorkflowTable.id],
		}),
		actor: one(userTable, {
			fields: [ownershipWorkflowEventTable.actorUserId],
			references: [userTable.id],
			relationName: "ownershipWorkflowEventActor",
		}),
	})
);

export const lifecycleWorkflowRelations = relations(lifecycleWorkflowTable, ({ one }) => ({
	actor: one(userTable, {
		fields: [lifecycleWorkflowTable.actorUserId],
		references: [userTable.id],
	}),
}));

export const recruitmentListingRelations = relations(recruitmentListingTable, ({ one, many }) => ({
	user: one(userTable, {
		fields: [recruitmentListingTable.userId],
		references: [userTable.id],
	}),
	organization: one(organizationTable, {
		fields: [recruitmentListingTable.organizationId],
		references: [organizationTable.id],
	}),
	team: one(teamTable, {
		fields: [recruitmentListingTable.teamId],
		references: [teamTable.id],
	}),
	applications: many(recruitmentApplicationTable),
}));

export const recruitmentApplicationRelations = relations(
	recruitmentApplicationTable,
	({ one, many }) => ({
		listing: one(recruitmentListingTable, {
			fields: [recruitmentApplicationTable.listingId],
			references: [recruitmentListingTable.id],
		}),
		applicant: one(userTable, {
			fields: [recruitmentApplicationTable.applicantUserId],
			references: [userTable.id],
		}),
		applicantTeam: one(teamTable, {
			fields: [recruitmentApplicationTable.applicantTeamId],
			references: [teamTable.id],
		}),
		applicantOrganization: one(organizationTable, {
			fields: [recruitmentApplicationTable.applicantOrganizationId],
			references: [organizationTable.id],
		}),
		chatChannels: many(chatChannelTable, { relationName: "recruitmentChatChannels" }),
	})
);

export const updatePostRelations = relations(updatePostTable, ({ one }) => ({
	author: one(userTable, {
		fields: [updatePostTable.authorUserId],
		references: [userTable.id],
	}),
	organization: one(organizationTable, {
		fields: [updatePostTable.organizationId],
		references: [organizationTable.id],
	}),
	team: one(teamTable, {
		fields: [updatePostTable.teamId],
		references: [teamTable.id],
	}),
}));

export const availabilityRelations = relations(availabilityTable, ({ one }) => ({
	user: one(userTable, {
		fields: [availabilityTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [availabilityTable.teamId],
		references: [teamTable.id],
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
		relationName: "scrimCreatedBy",
	}),
	disputeResolvedBy: one(userTable, {
		fields: [scrimTable.disputeResolvedByUserId],
		references: [userTable.id],
		relationName: "scrimDisputeResolvedBy",
	}),
	disputeRespondedBy: one(userTable, {
		fields: [scrimTable.disputeRespondedByUserId],
		references: [userTable.id],
		relationName: "scrimDisputeRespondedBy",
	}),
	resultRevisions: many(scrimResultRevisionTable),
	negotiationRevisions: many(scrimNegotiationRevisionTable),
	maps: many(scrimMapTable),
	confirmations: many(scrimConfirmationTable),
	ocrJobs: many(ocrJobTable),
	ratingEvents: many(teamRatingEventTable),
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

export const scrimResultRevisionRelations = relations(scrimResultRevisionTable, ({ one }) => ({
	scrim: one(scrimTable, {
		fields: [scrimResultRevisionTable.scrimId],
		references: [scrimTable.id],
	}),
	reportingTeam: one(teamTable, {
		fields: [scrimResultRevisionTable.reportingTeamId],
		references: [teamTable.id],
	}),
	submittedBy: one(userTable, {
		fields: [scrimResultRevisionTable.submittedByUserId],
		references: [userTable.id],
	}),
	sourceOcrJob: one(ocrJobTable, {
		fields: [scrimResultRevisionTable.sourceOcrJobId],
		references: [ocrJobTable.id],
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

export const teamRatingEventRelations = relations(teamRatingEventTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [teamRatingEventTable.teamId],
		references: [teamTable.id],
	}),
	scrim: one(scrimTable, {
		fields: [teamRatingEventTable.scrimId],
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
	recruitmentApplication: one(recruitmentApplicationTable, {
		fields: [chatChannelTable.recruitmentApplicationId],
		references: [recruitmentApplicationTable.id],
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

export const chatMessageRelations = relations(chatMessageTable, ({ one, many }) => ({
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
	reads: many(chatMessageReadTable),
}));

export const chatMessageReadRelations = relations(chatMessageReadTable, ({ one }) => ({
	message: one(chatMessageTable, {
		fields: [chatMessageReadTable.messageId],
		references: [chatMessageTable.id],
	}),
	user: one(userTable, {
		fields: [chatMessageReadTable.userId],
		references: [userTable.id],
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

export const teamInviteRelations = relations(teamInviteTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [teamInviteTable.teamId],
		references: [teamTable.id],
	}),
	invitee: one(userTable, {
		fields: [teamInviteTable.inviteeUserId],
		references: [userTable.id],
		relationName: "inviteeTeamInvites",
	}),
	inviter: one(userTable, {
		fields: [teamInviteTable.inviterUserId],
		references: [userTable.id],
		relationName: "inviterTeamInvites",
	}),
}));

export const orgInviteRelations = relations(orgInviteTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [orgInviteTable.organizationId],
		references: [organizationTable.id],
	}),
	invitee: one(userTable, {
		fields: [orgInviteTable.inviteeUserId],
		references: [userTable.id],
		relationName: "inviteeOrgInvites",
	}),
	inviter: one(userTable, {
		fields: [orgInviteTable.inviterUserId],
		references: [userTable.id],
		relationName: "inviterOrgInvites",
	}),
}));

export const scrimNegotiationRevisionRelations = relations(
	scrimNegotiationRevisionTable,
	({ one }) => ({
		scrim: one(scrimTable, {
			fields: [scrimNegotiationRevisionTable.scrimId],
			references: [scrimTable.id],
		}),
		actor: one(userTable, {
			fields: [scrimNegotiationRevisionTable.actorUserId],
			references: [userTable.id],
		}),
		actorTeam: one(teamTable, {
			fields: [scrimNegotiationRevisionTable.actorTeamId],
			references: [teamTable.id],
		}),
	})
);
