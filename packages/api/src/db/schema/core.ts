import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { userTable } from "./auth";

import {
	channelTypeEnum,
	confirmationStatusEnum,
	disputeResolutionEnum,
	gameModeEnum,
	mapTypeEnum,
	matchResultEnum,
	memberTypeEnum,
	moderationCaseActionEnum,
	notificationTypeEnum,
	ocrJobStatusEnum,
	orgInviteStatusEnum,
	orgRoleEnum,
	ow2RankEnum,
	ow2RoleEnum,
	playerStatSideEnum,
	recruitmentApplicationStatusEnum,
	recruitmentListingCategoryEnum,
	recruitmentListingStatusEnum,
	recruitmentOwnerTypeEnum,
	reportCategoryEnum,
	reportStatusEnum,
	reportTargetTypeEnum,
	rosterStatusEnum,
	scrimStatusEnum,
	staffRoleEnum,
	teamInviteStatusEnum,
	teamMemberRoleEnum,
	updateScopeEnum,
	updateVisibilityEnum,
} from "./enums";
// ============================================================================
// PLAYER PROFILE — Extends auth user with Overwatch 2-specific data
// ============================================================================

/**
 * OW2-specific profile data, one-to-one with `userTable`. Separated from auth
 * to keep the auth layer game-agnostic. `battletag` is optional until linked.
 * Hero pool is stored relationally in `playerHeroTable`.
 */
export const playerProfileTable = pgTable(
	"player_profile",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.unique()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Blizzard BattleTag, optional until linked. */
		battletag: text("battletag"),

		/** Primary competitive role. */
		primaryRole: ow2RoleEnum("primary_role").notNull(),

		/** Secondary role for flex players. */
		secondaryRole: ow2RoleEnum("secondary_role"),

		/** Public competitive rank. */
		rank: ow2RankEnum("rank"),

		/** Rank division 1-5 within the tier (1 = highest). */
		rankDivision: smallint("rank_division"),

		/** Controls public profile visibility. Values: "public" | "teams_only" | "private". */
		profileVisibility: text("profile_visibility").notNull().default("public"),

		/** Controls whether availability intent is shown outside authenticated team contexts. */
		availabilityVisibility: text("availability_visibility").notNull().default("public"),

		/** Controls whether player-owned recruiting listings are discoverable publicly. */
		recruitingDiscoverability: boolean("recruiting_discoverability").notNull().default(true),

		/** Controls public team history and public scrim summary visibility. */
		publicHistoryVisibility: text("public_history_visibility").notNull().default("public"),

		/** Initial intent captured during onboarding. */
		participationIntent: text("participation_intent").notNull().default("find_team"),

		/** Pre-team availability signal captured during onboarding. */
		availabilityIntent: text("availability_intent").notNull().default("not_sure"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("player_profile_user_idx").on(table.userId),
		index("player_profile_battletag_idx").on(table.battletag),
		index("player_profile_role_rank_idx").on(table.primaryRole, table.rank),
	]
);

// ============================================================================
// ONBOARDING DRAFT — Server-backed progress before profile completion
// ============================================================================

type OnboardingDraftData = {
	battletag?: string;
	primaryRole?: "tank" | "damage" | "support" | null;
	secondaryRole?: "tank" | "damage" | "support" | null;
	rank?:
		| "bronze"
		| "silver"
		| "gold"
		| "platinum"
		| "diamond"
		| "master"
		| "grandmaster"
		| "champion"
		| null;
	rankDivision?: number | null;
	heroPool?: string[];
	participationIntent?:
		| "find_team"
		| "recruit_players"
		| "schedule_scrims"
		| "just_browsing"
		| null;
	availabilityIntent?: "weekdays" | "weekends" | "flexible" | "not_sure" | null;
};

export const onboardingDraftTable = pgTable(
	"onboarding_draft",
	{
		userId: uuid("user_id")
			.primaryKey()
			.references(() => userTable.id, { onDelete: "cascade" }),
		currentStep: text("current_step").notNull().default("battletag"),
		data: jsonb("data").$type<OnboardingDraftData>().notNull().default({}),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("onboarding_draft_updated_idx").on(table.updatedAt)]
);

// ============================================================================
// HERO REGISTRY — Overwatch 2 hero catalogue
// ============================================================================

/**
 * Authoritative list of OW2 heroes. The `id` is a stable kebab-case slug
 * (e.g. "dva", "soldier-76") that is stored in `playerProfileTable.heroPool`.
 * Never change `id` values — they are persisted in player data.
 * `isActive` toggles hero availability without touching existing profiles.
 */
export const heroTable = pgTable(
	"hero",
	{
		id: text("id").primaryKey(),
		displayName: text("display_name").notNull(),
		role: ow2RoleEnum("role").notNull(),
		/** URL to hero portrait stored in object storage. */
		imageUrl: text("image_url"),
		/** Short one-line description shown in UI tooltips. */
		description: text("description"),
		/** False hides hero from pickers (e.g. temporarily removed from competitive). */
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("hero_role_idx").on(table.role), index("hero_active_idx").on(table.isActive)]
);

// ============================================================================
// MAP REGISTRY — Overwatch 2 map catalogue
// ============================================================================

/**
 * Authoritative list of OW2 maps. `id` is a stable kebab-case slug stored in
 * scrim records. `isActive` controls which maps appear in scrim map-pool pickers.
 * Legacy assault (2CP) maps are seeded with `isActive: false`.
 */
export const mapTable = pgTable(
	"map",
	{
		id: text("id").primaryKey(),
		displayName: text("display_name").notNull(),
		mapType: mapTypeEnum("map_type").notNull(),
		/** URL to map preview image stored in object storage. */
		imageUrl: text("image_url"),
		/** False removes map from scrim scheduling UI without deleting history. */
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("map_type_idx").on(table.mapType), index("map_active_idx").on(table.isActive)]
);

// ============================================================================
// PLAYER HERO POOL — Junction between players and their preferred heroes
// ============================================================================

/**
 * Relational hero pool: one row per hero a player has selected.
 * Replaces the former JSONB `heroPool` column on `playerProfileTable`.
 */
export const playerHeroTable = pgTable(
	"player_hero",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		heroId: text("hero_id")
			.notNull()
			.references(() => heroTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.heroId] }),
		index("player_hero_user_idx").on(table.userId),
		index("player_hero_hero_idx").on(table.heroId),
	]
);

// ============================================================================
// PLAYER MAP POOL — Junction between players and their preferred maps
// ============================================================================

/**
 * Relational map pool: one row per map a player has selected as preferred.
 */
export const playerMapTable = pgTable(
	"player_map",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		mapId: text("map_id")
			.notNull()
			.references(() => mapTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.mapId] }),
		index("player_map_user_idx").on(table.userId),
		index("player_map_map_idx").on(table.mapId),
	]
);

// ============================================================================
// ORGANIZATIONS — Multi-tenant root entity
// ============================================================================

/**
 * Multi-tenant root entity that owns one or more teams. `slug` is the
 * URL-friendly unique identifier (e.g. `/org/team-liquid`).
 */
export const organizationTable = pgTable(
	"organization",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		description: text("description"),
		avatarUrl: text("avatar_url"),
		bannerUrl: text("banner_url"),

		/** Optional public website URL for the organization (e.g. "https://example.com"). */
		website: text("website"),

		/** Optional Discord server invite URL or handle. */
		discord: text("discord"),

		/** Optional Twitter/X username or profile URL. */
		twitter: text("twitter"),

		/** Controls whether the organization appears on public organization surfaces. */
		isPublic: boolean("is_public").notNull().default(true),

		/** Operational lifecycle: active, archived, deletion_pending, or irreversible. */
		lifecycleStatus: text("lifecycle_status").notNull().default("active"),
		lifecycleUpdatedAt: timestamp("lifecycle_updated_at", { mode: "date" }),

		/** Org creator. Denormalized for fast access. */
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("organization_slug_idx").on(table.slug),
		uniqueIndex("organization_name_unique_idx").on(sql`lower(${table.name})`),
	]
);

// ============================================================================
// ORGANIZATION MEMBERS — RBAC bridge between users and organizations
// ============================================================================

/**
 * RBAC bridge between users and organizations. A user may belong to multiple
 * organizations, each with a distinct role.
 */
export const organizationMemberTable = pgTable(
	"organization_member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: orgRoleEnum("role").notNull().default("member"),
		memberType: memberTypeEnum("member_type").notNull().default("player"),
		staffRole: staffRoleEnum("staff_role"),
		gameRole: ow2RoleEnum("game_role"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("org_member_unique_idx").on(table.organizationId, table.userId),
		index("org_member_user_idx").on(table.userId),
	]
);

// ============================================================================
// TEAMS — A roster within an organization
// ============================================================================

/**
 * A competitive roster owned by an organization. `rating` is a composite rating
 * updated after confirmed scrims. Archived teams are hidden from matchmaking.
 */
export const teamTable = pgTable(
	"team",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		tag: text("tag").notNull(), // short clan tag, e.g. "TL"
		description: text("description"),
		avatarUrl: text("avatar_url"),
		bannerUrl: text("banner_url"),

		/** Composite team rating for matchmaking. */
		rating: integer("rating").notNull().default(1500),
		ratingDeviation: integer("rating_deviation").notNull().default(350),

		/** Completed scrim count for rating calibration. */
		matchesPlayed: integer("matches_played").notNull().default(0),

		/** Archived teams are hidden from matchmaking.
		 * Invariant enforced by DB CHECK: is_archived = (lifecycle_status != 'active').
		 * Use lifecycleStatus as the source of truth; is_archived is a denormalised flag. */
		isArchived: boolean("is_archived").notNull().default(false),

		/** Operational lifecycle: active, archived, deletion_pending, or irreversible. */
		lifecycleStatus: text("lifecycle_status").notNull().default("active"),
		lifecycleUpdatedAt: timestamp("lifecycle_updated_at", { mode: "date" }),

		/** Whether the team is actively looking for new players. */
		isRecruiting: boolean("is_recruiting").notNull().default(false),

		/** Controls whether the team appears on public team and org surfaces. */
		isPublic: boolean("is_public").notNull().default(true),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("team_org_idx").on(table.organizationId),
		// Team identity is org-scoped. Archived teams release their name/tag for reuse.
		uniqueIndex("team_org_active_name_unique_idx")
			.on(table.organizationId, sql`lower(${table.name})`)
			.where(sql`${table.isArchived} = false`),
		uniqueIndex("team_org_active_tag_unique_idx")
			.on(table.organizationId, sql`upper(${table.tag})`)
			.where(sql`${table.isArchived} = false`),
		// Matchmaking: "find active teams in rating range"
		index("team_matchmaking_idx").on(table.rating, table.isArchived),
	]
);

// ============================================================================
// TEAM ROSTER — Many-to-many between teams and players
// ============================================================================

/**
 * Many-to-many between teams and players. A player may be on multiple teams
 * (e.g. main + academy) with a different role per roster.
 */
export const teamRosterTable = pgTable(
	"team_roster",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Role on this specific team. */
		memberType: memberTypeEnum("member_type").notNull().default("player"),
		roleInTeam: ow2RoleEnum("role_in_team"),
		staffRole: staffRoleEnum("staff_role"),
		permissionRole: teamMemberRoleEnum("permission_role").notNull().default("member"),
		status: rosterStatusEnum("status").notNull().default("active"),

		/** Join date, distinct from createdAt for transfer tracking. */
		joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
		leftAt: timestamp("left_at", { mode: "date" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// A player can only hold one active slot per team
		uniqueIndex("team_roster_unique_idx").on(table.teamId, table.userId),
		index("team_roster_user_idx").on(table.userId),
		// Quickly list active roster for a team
		index("team_roster_active_idx").on(table.teamId, table.status),
	]
);

type OwnershipWorkflowMetadata = {
	reason?: string | null;
	resultReason?: string | null;
	priorOwnerUserId?: string | null;
	previousAdminUserIds?: string[];
	resultingAdminUserIds?: string[];
};

type OwnershipWorkflowEventMetadata = {
	previousOwnerUserId?: string | null;
	newOwnerUserId?: string | null;
	previousAdminUserIds?: string[];
	resultingAdminUserIds?: string[];
	resultReason?: string | null;
};

type LifecycleWorkflowMetadata = {
	confirmName?: string | null;
	priorLifecycleStatus?: string | null;
	priorIsPublic?: boolean | null;
	priorIsRecruiting?: boolean | null;
	retentionPolicy?: string | null;
	blockingReason?: string | null;
};

export const lifecycleWorkflowTable = pgTable(
	"lifecycle_workflow",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id").notNull(),
		action: text("action").notNull(),
		/** Entity lifecycle state carried by this workflow row (archived, deletion_pending, irreversible). */
		status: text("status").notNull().default("pending"),
		/** Workflow process state: "open" while the workflow is active; "settled" when it has been
		 *  resolved (restored, cancelled, expired, or irreversibly settled). Used for the uniqueness
		 *  constraint so a second open workflow cannot be created for the same entity. */
		workflowState: text("workflow_state").notNull().default("open"),
		actorUserId: uuid("actor_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		reason: text("reason"),
		recoveryUntil: timestamp("recovery_until", { mode: "date" }),
		settledAt: timestamp("settled_at", { mode: "date" }),
		result: text("result"),
		metadata: jsonb("metadata").$type<LifecycleWorkflowMetadata>().notNull().default({}),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("lifecycle_workflow_target_idx").on(table.entityType, table.entityId),
		index("lifecycle_workflow_actor_idx").on(table.actorUserId),
		// D2-P: index on workflowState ensures at most one open workflow per entity at all times,
		// including during the initial insertion (no race with pending→archived status update).
		uniqueIndex("lifecycle_workflow_open_unique_idx")
			.on(table.entityType, table.entityId)
			.where(sql`${table.workflowState} = 'open'`),
	]
);

export const ownershipWorkflowTable = pgTable(
	"ownership_workflow",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id").notNull(),
		kind: text("kind").notNull(),
		status: text("status").notNull().default("pending"),
		requesterUserId: uuid("requester_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		currentOwnerUserId: uuid("current_owner_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		recipientUserId: uuid("recipient_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		recoveryTargetUserId: uuid("recovery_target_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		verificationState: text("verification_state").notNull().default("required"),
		reviewState: text("review_state").notNull().default("not_required"),
		reason: text("reason"),
		expiresAt: timestamp("expires_at", { mode: "date" }),
		resolvedAt: timestamp("resolved_at", { mode: "date" }),
		result: text("result"),
		metadata: jsonb("metadata").$type<OwnershipWorkflowMetadata>().notNull().default({}),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("ownership_workflow_target_idx").on(table.entityType, table.entityId),
		index("ownership_workflow_requester_idx").on(table.requesterUserId),
		index("ownership_workflow_recipient_idx").on(table.recipientUserId),
		uniqueIndex("ownership_workflow_open_unique_idx")
			.on(table.entityType, table.entityId)
			.where(sql`${table.status} in ('pending', 'review_required', 'blocked')`),
	]
);

export const ownershipWorkflowEventTable = pgTable(
	"ownership_workflow_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowId: uuid("workflow_id")
			.notNull()
			.references(() => ownershipWorkflowTable.id, { onDelete: "cascade" }),
		actorUserId: uuid("actor_user_id").references(() => userTable.id, { onDelete: "set null" }),
		action: text("action").notNull(),
		fromStatus: text("from_status"),
		toStatus: text("to_status").notNull(),
		reason: text("reason"),
		metadata: jsonb("metadata").$type<OwnershipWorkflowEventMetadata>().notNull().default({}),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("ownership_workflow_event_workflow_idx").on(table.workflowId),
		index("ownership_workflow_event_actor_idx").on(table.actorUserId),
	]
);

// ============================================================================
// RECRUITMENT LISTINGS
// ============================================================================

/**
 * Recruitment listings. Team-owned listings set `teamId`; player-owned listings
 * leaves it null. `heroPoolFilter` uses a GIN index for hero-based matching.
 */
export const recruitmentListingTable = pgTable(
	"recruitment_listing",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		type: recruitmentListingCategoryEnum("type").notNull(),
		status: recruitmentListingStatusEnum("status").notNull().default("open"),
		ownerType: recruitmentOwnerTypeEnum("owner_type").notNull().default("player"),

		/** User who created the listing. */
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		organizationId: uuid("organization_id").references(() => organizationTable.id, {
			onDelete: "cascade",
		}),

		/** Set for team-owned listings. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "cascade" }),

		title: text("title").notNull().default(""),
		memberType: memberTypeEnum("member_type").notNull().default("player"),
		staffRole: staffRoleEnum("staff_role"),

		/** Target roles as JSONB array. */
		rolesNeeded: jsonb("roles_needed").$type<string[]>().notNull().default([]),

		/** Minimum acceptable rank tier. */
		minRank: ow2RankEnum("min_rank"),

		/** Maximum acceptable rank tier. */
		maxRank: ow2RankEnum("max_rank"),

		/** Minimum acceptable team rating. */
		minRating: integer("min_rating"),

		/** Maximum acceptable team rating. */
		maxRating: integer("max_rating"),

		/** Hero pool filter, GIN-indexed. */
		heroPoolFilter: jsonb("hero_pool_filter").$type<string[]>().default([]),

		/** Freeform description / requirements. */
		description: text("description"),

		/** Region preference. */
		region: text("region"),

		/** Auto-expiry date (typically now + 7 days). */
		expiresAt: timestamp("expires_at", { mode: "date" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// Primary recruiting feed query: open listings of a given type
		index("recruitment_listing_feed_idx").on(table.type, table.status),
		// Filter by role + rank range for the "find me a support" queries
		index("recruitment_listing_role_rank_idx").on(table.status, table.minRank, table.maxRank),
		index("recruitment_listing_rating_range_idx").on(
			table.status,
			table.minRating,
			table.maxRating
		),
		index("recruitment_listing_hero_pool_gin_idx").using(
			"gin",
			table.heroPoolFilter.op("jsonb_ops")
		),
		// My listings
		index("recruitment_listing_user_idx").on(table.userId),
		index("recruitment_listing_team_idx").on(table.teamId),
	]
);

/** Applications to recruitment listings, from players or teams. */
export const recruitmentApplicationTable = pgTable(
	"recruitment_application",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		listingId: uuid("listing_id")
			.notNull()
			.references(() => recruitmentListingTable.id, { onDelete: "cascade" }),

		/** User who is applying or reaching out. */
		applicantUserId: uuid("applicant_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Applicant team for team-initiated outreach. */
		applicantTeamId: uuid("applicant_team_id").references(() => teamTable.id, {
			onDelete: "cascade",
		}),
		applicantOrganizationId: uuid("applicant_organization_id").references(
			() => organizationTable.id,
			{
				onDelete: "cascade",
			}
		),

		message: text("message"),
		status: recruitmentApplicationStatusEnum("status").notNull().default("pending"),

		reviewerNotes: text("reviewer_notes"),
		isShortlisted: boolean("is_shortlisted").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// Prevent duplicate pending applications (partial index — allows re-apply after withdrawal/rejection)
		uniqueIndex("recruitment_application_unique_idx")
			.on(table.listingId, table.applicantUserId)
			.where(sql`${table.status} = 'pending'`),
		index("recruitment_application_listing_idx").on(table.listingId),
		index("recruitment_application_user_idx").on(table.applicantUserId),
	]
);

// ============================================================================
// UPDATES — Team and organization announcements
// ============================================================================

/**
 * Team and organization announcements published into workspace and public feeds.
 * `scopeType` determines which parent entity owns the update. `visibility`
 * controls whether the update stays inside the workspace or appears publicly.
 */
export const updatePostTable = pgTable(
	"update_post",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		scopeType: updateScopeEnum("scope_type").notNull(),
		visibility: updateVisibilityEnum("visibility").notNull().default("workspace"),

		authorUserId: uuid("author_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		organizationId: uuid("organization_id").references(() => organizationTable.id, {
			onDelete: "cascade",
		}),
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "cascade" }),

		title: text("title").notNull(),
		body: text("body").notNull(),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("update_post_scope_idx").on(table.scopeType, table.createdAt),
		index("update_post_team_idx").on(table.teamId, table.createdAt),
		index("update_post_org_idx").on(table.organizationId, table.createdAt),
		index("update_post_visibility_idx").on(table.visibility, table.createdAt),
		index("update_post_author_idx").on(table.authorUserId, table.createdAt),
	]
);

// ============================================================================
// AVAILABILITY — Player scheduling windows for auto-suggesting scrim times
// ============================================================================

/**
 * Recurring or one-off availability windows for scheduling scrims.
 * `dayOfWeek` + `startTime`/`endTime` define a recurring pattern;
 * `specificDate` overrides it for one-off slots.
 */
export const availabilityTable = pgTable(
	"availability",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Team this availability is scoped to. */
		teamId: uuid("team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),

		/** Day of the week (0=Sun, 6=Sat). Null for one-off slots. */
		dayOfWeek: smallint("day_of_week"),

		/** Specific date override. Null for recurring slots. */
		specificDate: timestamp("specific_date", { mode: "date" }),

		/** Start time as "HH:MM" in the player's timezone. */
		startTime: text("start_time").notNull(),

		/** End time as "HH:MM". */
		endTime: text("end_time").notNull(),

		/** IANA timezone string. */
		timezone: text("timezone").notNull().default("UTC"),

		/** Optional user-defined label for this availability window. */
		label: text("label"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("availability_user_idx").on(table.userId),
		index("availability_team_idx").on(table.teamId),
		index("availability_user_team_idx").on(table.userId, table.teamId),
		index("availability_schedule_idx").on(table.userId, table.teamId, table.dayOfWeek),
		index("availability_specific_idx").on(table.userId, table.teamId, table.specificDate),
	]
);

// ============================================================================
// SCRIMS — The match entity between two teams
// ============================================================================

/**
 * A scrim between two teams. `homeTeamId` is the requester; `awayTeamId` is
 * the opponent. Lifecycle: pending → accepted → scheduled → in_progress →
 * awaiting_confirmation → completed | disputed. `config` stores flexible
 * settings (map pool, best-of, hero restrictions) as JSONB.
 */
export const scrimTable = pgTable(
	"scrim",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		homeTeamId: uuid("home_team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "restrict" }),
		awayTeamId: uuid("away_team_id").references(() => teamTable.id, { onDelete: "restrict" }),

		status: scrimStatusEnum("status").notNull().default("pending"),

		/** Flexible scrim configuration as JSONB. */
		config: jsonb("config")
			.$type<{
				mapPool?: string[];
				bestOf?: number;
				heroRestrictions?: string[];
				format?: string;
			}>()
			.default({}),

		/** Scheduling */
		scheduledAt: timestamp("scheduled_at", { mode: "date" }),
		startedAt: timestamp("started_at", { mode: "date" }),
		endedAt: timestamp("ended_at", { mode: "date" }),

		/** Series score computed from confirmed map results. */
		homeMapScore: smallint("home_map_score").notNull().default(0),
		awayMapScore: smallint("away_map_score").notNull().default(0),

		/** Dispute resolution outcome. */
		disputeResolution: disputeResolutionEnum("dispute_resolution"),

		/** Admin who resolved the dispute. */
		disputeResolvedByUserId: uuid("dispute_resolved_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		/** Timestamp of dispute resolution. */
		disputeResolvedAt: timestamp("dispute_resolved_at", { mode: "date" }),

		/** Admin notes on the dispute resolution. */
		disputeNotes: text("dispute_notes"),

		/** Reporting team's text response to a dispute (before org-level resolution). */
		disputeResponse: text("dispute_response"),

		/** Timestamp when the reporting team responded to the dispute. */
		disputeRespondedAt: timestamp("dispute_responded_at", { withTimezone: true }),

		/** User who submitted the dispute response on behalf of the reporting team. */
		disputeRespondedByUserId: uuid("dispute_responded_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		/** User who created this scrim request. */
		createdByUserId: uuid("created_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		/** Optional message from the requester. */
		message: text("message"),

		homeTeamNameSnapshot: text("home_team_name_snapshot"),
		homeTeamTagSnapshot: text("home_team_tag_snapshot"),
		awayTeamNameSnapshot: text("away_team_name_snapshot"),
		awayTeamTagSnapshot: text("away_team_tag_snapshot"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("scrim_home_team_idx").on(table.homeTeamId),
		index("scrim_away_team_idx").on(table.awayTeamId),
		index("scrim_status_idx").on(table.status),
		// "upcoming scrims" query
		index("scrim_schedule_idx").on(table.status, table.scheduledAt),
		// History for a specific team
		index("scrim_team_history_idx").on(table.homeTeamId, table.status, table.scheduledAt),
		// Prevent concurrent duplicate active scrims between the same pair (bidirectional)
		uniqueIndex("scrim_active_pair_unique_idx")
			.on(
				sql`LEAST(${table.homeTeamId}, ${table.awayTeamId})`,
				sql`GREATEST(${table.homeTeamId}, ${table.awayTeamId})`
			)
			.where(
				sql`${table.status} IN ('pending', 'accepted', 'scheduled', 'in_progress') AND ${table.awayTeamId} IS NOT NULL`
			),
	]
);

// ============================================================================
// SCRIM CONFIRMATIONS — Both teams must confirm before ratings are updated
// ============================================================================

/**
 * Post-scrim result confirmation. One row per team per scrim. Both teams must
 * confirm before team ratings are updated; a dispute from either side triggers admin review.
 */
export const scrimConfirmationTable = pgTable(
	"scrim_confirmation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		status: confirmationStatusEnum("status").notNull().default("pending"),

		/** Dispute reason, if applicable. */
		disputeReason: text("dispute_reason"),

		/** User who submitted the confirmation. */
		confirmedByUserId: uuid("confirmed_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		confirmedAt: timestamp("confirmed_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// One confirmation per team per scrim
		uniqueIndex("scrim_confirm_unique_idx").on(table.scrimId, table.teamId),
		index("scrim_confirm_scrim_idx").on(table.scrimId),
	]
);

// ============================================================================
// SCRIM RESULT REVISIONS — Immutable reviewed result history
// ============================================================================

type ScrimResultRevisionJsonValue =
	| string
	| number
	| boolean
	| null
	| { [key: string]: ScrimResultRevisionJsonValue }
	| ScrimResultRevisionJsonValue[];

type ScrimResultRevisionPlayerSnapshot = {
	playerName: string;
	side: "home" | "away" | "unknown";
	hero: string | null;
	role: "tank" | "damage" | "support" | null;
	eliminations: number | null;
	assists: number | null;
	deaths: number | null;
	damage: number | null;
	healing: number | null;
	mitigation: number | null;
};

type ScrimResultRevisionMapSnapshot = {
	mapOrder: number;
	mapName: string;
	mapType:
		| "assault"
		| "clash"
		| "control"
		| "escort"
		| "flashpoint"
		| "hybrid"
		| "push"
		| "unknown";
	homeScore: number;
	awayScore: number;
	durationSeconds: number | null;
	players: ScrimResultRevisionPlayerSnapshot[];
};

type ScrimResultRevisionSnapshot = {
	homeMapScore: number;
	awayMapScore: number;
	startedAt: string | null;
	endedAt: string | null;
	maps: ScrimResultRevisionMapSnapshot[];
};

type ScrimResultFieldChange = {
	path: string;
	before: ScrimResultRevisionJsonValue;
	after: ScrimResultRevisionJsonValue;
};

type ScrimResultChangeSummary = {
	basis: "ocr_job" | "previous_revision" | "existing_result" | "manual_baseline";
	changeCount: number;
	fieldChanges: ScrimResultFieldChange[];
};

/**
 * Immutable snapshots of every reviewed result submission. This preserves the
 * authoritative history even when the latest reviewed result replaces the
 * current `scrim_map` / `scrim_player_stat` rows.
 */
export const scrimResultRevisionTable = pgTable(
	"scrim_result_revision",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),
		revisionNumber: smallint("revision_number").notNull(),
		reportingTeamId: uuid("reporting_team_id").references(() => teamTable.id, {
			onDelete: "set null",
		}),
		submittedByUserId: uuid("submitted_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		sourceOcrJobId: uuid("source_ocr_job_id").references(() => ocrJobTable.id, {
			onDelete: "set null",
		}),
		homeMapScore: smallint("home_map_score").notNull().default(0),
		awayMapScore: smallint("away_map_score").notNull().default(0),
		startedAt: timestamp("started_at", { mode: "date" }),
		endedAt: timestamp("ended_at", { mode: "date" }),
		snapshot: jsonb("snapshot").$type<ScrimResultRevisionSnapshot>().notNull(),
		changeSummary: jsonb("change_summary").$type<ScrimResultChangeSummary>().notNull(),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("scrim_result_revision_unique_idx").on(table.scrimId, table.revisionNumber),
		index("scrim_result_revision_scrim_idx").on(table.scrimId, table.createdAt),
		index("scrim_result_revision_reporting_team_idx").on(table.reportingTeamId),
		index("scrim_result_revision_source_ocr_idx").on(table.sourceOcrJobId),
	]
);

// ============================================================================
// SCRIM NEGOTIATION REVISIONS — Append-only log of negotiation actions
// ============================================================================

export const scrimNegotiationRevisionTable = pgTable(
	"scrim_negotiation_revision",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),
		actorUserId: uuid("actor_user_id").references(() => userTable.id, { onDelete: "set null" }),
		actorTeamId: uuid("actor_team_id").references(() => teamTable.id, { onDelete: "set null" }),
		action: text("action").notNull(), // "accept" | "decline" | "reschedule" | "propose_changes" | "expired"
		priorScheduledAt: timestamp("prior_scheduled_at", { mode: "date" }),
		proposedScheduledAt: timestamp("proposed_scheduled_at", { mode: "date" }),
		priorConfig: jsonb("prior_config").$type<{
			mapPool?: string[];
			bestOf?: number;
			heroRestrictions?: string[];
			format?: string;
		}>(),
		proposedConfig: jsonb("proposed_config").$type<{
			mapPool?: string[];
			bestOf?: number;
			heroRestrictions?: string[];
			format?: string;
		}>(),
		priorMessage: text("prior_message"),
		proposedMessage: text("proposed_message"),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("scrim_neg_rev_scrim_idx").on(table.scrimId),
		index("scrim_neg_rev_actor_user_idx").on(table.actorUserId),
	]
);

// ============================================================================
// SCRIM MAPS — Per-map results within a scrim (matches the OCR "matches" output)
// ============================================================================

/**
 * One row per map played within a scrim. `result` is from the home team's
 * perspective. `durationSeconds` is parsed from the OCR "MM:SS" string in
 * the application layer.
 */
export const scrimMapTable = pgTable(
	"scrim_map",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),

		/** 1-indexed position in the series. */
		mapOrder: smallint("map_order").notNull(),

		/** Map name normalized to Title Case. */
		mapName: text("map_name").notNull(),

		/** Core mode type. */
		mapType: mapTypeEnum("map_type").notNull(),

		/** Queue / lobby type. */
		gameMode: gameModeEnum("game_mode").notNull().default("custom_game"),

		/** Duration in seconds, parsed from OCR "MM:SS". */
		durationSeconds: integer("duration_seconds"),

		/** Result from the home team's perspective. */
		result: matchResultEnum("result").notNull(),

		/** Home team round score on this map. */
		homeScore: smallint("home_score").notNull().default(0),

		/** Away team round score on this map. */
		awayScore: smallint("away_score").notNull().default(0),

		/** OCR job that extracted this data. */
		ocrJobId: uuid("ocr_job_id").references(() => ocrJobTable.id, { onDelete: "set null" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// Enforce one entry per map position per scrim
		uniqueIndex("scrim_map_order_idx").on(table.scrimId, table.mapOrder),
		index("scrim_map_scrim_idx").on(table.scrimId),
		// Analytics: "win rate on King's Row"
		index("scrim_map_name_idx").on(table.mapName, table.result),
		index("scrim_map_type_idx").on(table.mapType),
	]
);

// ============================================================================
// SCRIM PLAYER STATS — Per-player per-map stats (matches OCR "teams.players" output)
// ============================================================================

/**
 * Full stat line per player per map, sourced from OCR output. `userId` is
 * nullable for opponents not registered on the platform. `playerName` is
 * always the raw OCR-extracted value.
 */
export const scrimPlayerStatTable = pgTable(
	"scrim_player_stat",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimMapId: uuid("scrim_map_id")
			.notNull()
			.references(() => scrimMapTable.id, { onDelete: "cascade" }),

		/** Which side: home or away. */
		side: playerStatSideEnum("side").notNull(),

		/** Resolved platform user. Null for unregistered opponents. */
		userId: uuid("user_id").references(() => userTable.id, { onDelete: "set null" }),

		/** Platform team. Null for unregistered opponents. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "set null" }),

		/** Raw player name from OCR. */
		playerName: text("player_name").notNull(),

		/** Hero played on this map. */
		hero: text("hero"),

		/** Role played on this map. */
		role: ow2RoleEnum("role"),

		// ---- Core stat columns (direct from OCR) ----
		eliminations: integer("eliminations"),
		assists: integer("assists"),
		deaths: integer("deaths"),
		damage: integer("damage"),
		healing: integer("healing"),
		mitigation: integer("mitigation"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("player_stat_map_idx").on(table.scrimMapId),
		// "Show all my stats across all scrims"
		index("player_stat_user_idx").on(table.userId),
		// "Performance on a specific hero across all scrims"
		index("player_stat_hero_idx").on(table.userId, table.hero),
		// Per-team stats aggregation
		index("player_stat_team_idx").on(table.teamId),
		// Prevent duplicate stat rows per player per map
		uniqueIndex("player_stat_unique_idx").on(table.scrimMapId, table.playerName, table.side),
	]
);

// ============================================================================
// TEAM RATING EVENTS — Audit trail for team rating changes
// ============================================================================

/**
 * Immutable team rating change log keyed to scrims. One row per team per rated
 * scrim, preserving the before/after values and rating deviation changes.
 */
export const teamRatingEventTable = pgTable(
	"team_rating_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),
		ratingBefore: integer("rating_before").notNull(),
		ratingAfter: integer("rating_after").notNull(),
		ratingDelta: integer("rating_delta").notNull(),
		ratingDeviationBefore: integer("rating_deviation_before"),
		ratingDeviationAfter: integer("rating_deviation_after"),
		algorithmVersion: text("algorithm_version").notNull().default("glicko-1.0"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("team_rating_event_team_scrim_idx").on(table.teamId, table.scrimId),
		index("team_rating_event_team_idx").on(table.teamId, table.createdAt),
		index("team_rating_event_scrim_idx").on(table.scrimId),
	]
);

// ============================================================================
// OCR JOBS — Async processing pipeline tracking
// ============================================================================

/**
 * Lifecycle tracker for each screenshot submitted for AI/OCR processing.
 * `rawOcrOutput` stores the full JSON response for audit and re-processing.
 */
export const ocrJobTable = pgTable(
	"ocr_job",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),

		/** User who uploaded the screenshot. */
		submittedByUserId: uuid("submitted_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),

		/** Screenshot type: "game_history" or "scoreboard". */
		screenshotType: text("screenshot_type").notNull(),

		/** Image URL in object storage. */
		imageUrl: text("image_url").notNull(),

		status: ocrJobStatusEnum("status").notNull().default("queued"),
		progressStage: text("progress_stage").notNull().default("queued"),
		runAfter: timestamp("run_after", { mode: "date" }).notNull().defaultNow(),
		leaseExpiresAt: timestamp("lease_expires_at", { mode: "date" }),
		providerName: text("provider_name"),
		providerModel: text("provider_model"),
		promptVersion: text("prompt_version"),

		/** Full OCR JSON response for audit and re-processing. */
		rawOcrOutput: jsonb("raw_ocr_output"),
		validatedOutput: jsonb("validated_output"),
		confidenceFlags: jsonb("confidence_flags").$type<string[]>().notNull().default([]),

		/** Error message if the job failed. */
		errorCode: text("error_code"),
		errorMessage: text("error_message"),

		/** Processing duration in milliseconds. */
		processingTimeMs: integer("processing_time_ms"),

		/** Number of retry attempts. */
		retryCount: smallint("retry_count").notNull().default(0),

		startedAt: timestamp("started_at", { mode: "date" }),
		completedAt: timestamp("completed_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("ocr_job_scrim_idx").on(table.scrimId),
		index("ocr_job_status_idx").on(table.status),
		index("ocr_job_queue_idx").on(table.status, table.runAfter, table.leaseExpiresAt),
		index("ocr_job_user_idx").on(table.submittedByUserId),
	]
);

// ============================================================================
// NOTIFICATIONS — Async notification queue
// ============================================================================

export const notificationTable = pgTable(
	"notification",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		/** Recipient. */
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		type: notificationTypeEnum("type").notNull(),
		title: text("title").notNull(),
		body: text("body"),

		/** Polymorphic reference to the source entity. */
		referenceType: text("reference_type"), // "scrim" | "recruitment_listing" | "recruitment_application" | etc.
		referenceId: uuid("reference_id"),

		isRead: boolean("is_read").notNull().default(false),
		isDismissed: boolean("is_dismissed").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// "My unread notifications" — the primary inbox query
		index("notification_inbox_idx").on(table.userId, table.isRead, table.createdAt),
		index("notification_user_idx").on(table.userId),
	]
);

// ============================================================================
// MESSAGING — Channel-based chat system
// ============================================================================

/**
 * Conversation container with typed context. Five channel types drive different
 * access rules and lifecycles. Only the relevant polymorphic FK (`scrimId`,
 * `teamId`, `recruitmentApplicationId`) is set per channel. Archived channels are
 * read-only. Socket.io rooms map 1:1 to channel IDs as `channel:{id}`.
 */
export const chatChannelTable = pgTable(
	"chat_channel",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		channelType: channelTypeEnum("channel_type").notNull(),

		/** Channel name, auto-generated or custom. */
		name: text("name").notNull(),

		// ---- Polymorphic context references (only one is set per channel) ----

		/** Set for scrim_negotiation and scrim_lobby channels. */
		scrimId: uuid("scrim_id").references(() => scrimTable.id, { onDelete: "cascade" }),

		/** Set for team channels. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "cascade" }),

		/** Set for recruitment channels. */
		recruitmentApplicationId: uuid("recruitment_application_id").references(
			() => recruitmentApplicationTable.id,
			{
				onDelete: "cascade",
			}
		),

		/** Archived channels are read-only. */
		isArchived: boolean("is_archived").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// "All channels for this scrim" (negotiation + lobby)
		index("chat_channel_scrim_idx").on(table.scrimId),
		// "Team chat channel"
		index("chat_channel_team_idx").on(table.teamId),
		// "Recruitment thread for this application"
		index("chat_channel_recruitment_app_idx").on(table.recruitmentApplicationId),
		// "List active channels by type"
		index("chat_channel_type_idx").on(table.channelType, table.isArchived),
	]
);

/**
 * Channel membership controlling read/write access. `lastReadAt` powers unread
 * counts. Members are soft-removed via `leftAt` to preserve message history.
 */
export const chatChannelMemberTable = pgTable(
	"chat_channel_member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		channelId: uuid("channel_id")
			.notNull()
			.references(() => chatChannelTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Channel-scoped role. */
		role: text("role").notNull().default("member"),

		/** Last read timestamp for the unread badge. */
		lastReadAt: timestamp("last_read_at", { mode: "date" }),

		/** Left timestamp. Null means active. */
		leftAt: timestamp("left_at", { mode: "date" }),

		/** Muted members receive no push or SSE notifications. */
		isMuted: boolean("is_muted").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// One membership per user per channel
		uniqueIndex("chat_member_unique_idx").on(table.channelId, table.userId),
		// "All my active channels" — the sidebar query
		index("chat_member_user_idx").on(table.userId, table.leftAt),
		// "All active members of this channel"
		index("chat_member_channel_idx").on(table.channelId, table.leftAt),
	]
);

// ============================================================================
// TEAM INVITES — Direct invitations from managers to players
// ============================================================================

/**
 * A direct invitation from a team manager to a user. Distinct from recruitment
 * applications (which are player-initiated). Invite expires after 7 days.
 * The uniqueIndex prevents duplicate pending invites to the same player.
 */
export const teamInviteTable = pgTable(
	"team_invite",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),

		/** User who received the invite. */
		inviteeUserId: uuid("invitee_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Manager who sent the invite. */
		inviterUserId: uuid("inviter_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Role the invitee will join with. */
		memberType: memberTypeEnum("member_type").notNull().default("player"),
		roleInTeam: ow2RoleEnum("role_in_team"),
		staffRole: staffRoleEnum("staff_role"),
		permissionRole: teamMemberRoleEnum("permission_role").notNull().default("member"),

		status: teamInviteStatusEnum("status").notNull().default("pending"),

		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("team_invite_team_idx").on(table.teamId),
		index("team_invite_invitee_idx").on(table.inviteeUserId),
	]
);

// ============================================================================
// ORG INVITES — Direct invitations from org managers to users
// ============================================================================

/**
 * A direct invitation from an org owner/manager to a user.
 * Accepted invites insert a row into `organizationMemberTable`.
 */
export const orgInviteTable = pgTable(
	"org_invite",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),

		/** User who received the invite. */
		inviteeUserId: uuid("invitee_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Manager who sent the invite. */
		inviterUserId: uuid("inviter_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Role the invitee will join as. */
		role: orgRoleEnum("role").notNull().default("member"),
		memberType: memberTypeEnum("member_type").notNull().default("player"),
		staffRole: staffRoleEnum("staff_role"),
		gameRole: ow2RoleEnum("game_role"),

		status: orgInviteStatusEnum("status").notNull().default("pending"),

		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("org_invite_org_idx").on(table.organizationId),
		index("org_invite_invitee_idx").on(table.inviteeUserId),
	]
);

// ============================================================================
// MESSAGING — Channel-based chat system
// ============================================================================

/**
 * Append-only chat messages. Edits update `content` and set `editedAt`.
 * Soft-deleted via `deletedAt` (content shown as "[deleted]").
 * `replyToMessageId` enables quote-replies.
 */
export const chatMessageTable = pgTable(
	"chat_message",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		channelId: uuid("channel_id")
			.notNull()
			.references(() => chatChannelTable.id, { onDelete: "cascade" }),
		senderId: uuid("sender_id").references(() => userTable.id, { onDelete: "set null" }),

		/** Message content (markdown-lite). */
		content: text("content").notNull(),

		/** Quote-reply parent message. */
		replyToMessageId: uuid("reply_to_message_id"),

		/** Single attachment URL. */
		attachmentUrl: text("attachment_url"),

		/** System-generated message flag. */
		isSystemMessage: boolean("is_system_message").notNull().default(false),

		/** Soft-delete timestamp. Content shown as "[deleted]". */
		deletedAt: timestamp("deleted_at", { mode: "date" }),

		/** Edit timestamp. Null means never edited. */
		editedAt: timestamp("edited_at", { mode: "date" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		// Primary chat query: "last N messages in this channel, newest first"
		// Supports cursor-based pagination: WHERE channel_id = $id AND created_at < $cursor
		index("chat_message_channel_idx").on(table.channelId, table.createdAt),
		// "All messages by this user" — for moderation / GDPR data export
		index("chat_message_sender_idx").on(table.senderId),
		// Thread view: "all replies to this message"
		index("chat_message_reply_idx").on(table.replyToMessageId),
	]
);

/**
 * Per-message read receipts. Tracks which users have read which messages.
 * Used to show "seen by" indicators. The composite PK prevents duplicate rows.
 * The conversation-level `lastReadAt` on chat_channel_member still drives unread counts.
 */
export const chatMessageReadTable = pgTable(
	"chat_message_read",
	{
		messageId: uuid("message_id")
			.notNull()
			.references(() => chatMessageTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		readAt: timestamp("read_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.messageId, table.userId] }),
		// "All messages read by user" — for clearing unread state efficiently
		index("chat_message_read_user_idx").on(table.userId),
		// "Who has read this message" — for seen-by display in UI
		index("chat_message_read_msg_idx").on(table.messageId),
	]
);

// ============================================================================
// USER REPORTS — User-submitted trust and safety reports
// ============================================================================

export const userReportTable = pgTable(
	"user_report",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		reporterId: uuid("reporter_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		targetType: reportTargetTypeEnum("target_type").notNull(),
		targetId: uuid("target_id").notNull(),
		category: reportCategoryEnum("category").notNull(),
		reason: text("reason").notNull(),
		status: reportStatusEnum("status").notNull().default("pending"),
		/** Snapshot of target metadata captured at submission time. */
		targetSnapshot: jsonb("target_snapshot"),
		assignedModeratorId: uuid("assigned_moderator_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		assignedAt: timestamp("assigned_at", { mode: "date" }),
		resolvedAt: timestamp("resolved_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("user_report_reporter_idx").on(table.reporterId),
		index("user_report_target_idx").on(table.targetType, table.targetId),
		index("user_report_status_idx").on(table.status),
	]
);

export const userReportSupplementTable = pgTable(
	"user_report_supplement",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		reportId: uuid("report_id")
			.notNull()
			.references(() => userReportTable.id, { onDelete: "cascade" }),
		authorId: uuid("author_id").references(() => userTable.id, { onDelete: "set null" }),
		content: text("content").notNull(),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [index("user_report_supplement_report_idx").on(table.reportId)]
);

// ============================================================================
// MODERATION CASE EVENTS — Append-only audit trail for moderator case activity
// ============================================================================

export const moderationCaseEventTable = pgTable(
	"moderation_case_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		reportId: uuid("report_id")
			.notNull()
			.references(() => userReportTable.id, { onDelete: "cascade" }),
		// No FK: preserves audit trail when a moderator account is deleted
		moderatorId: uuid("moderator_id").notNull(),
		action: moderationCaseActionEnum("action").notNull(),
		/** Action-specific payload — notes content, resolution reason, etc. */
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("moderation_case_event_report_idx").on(table.reportId),
		index("moderation_case_event_moderator_idx").on(table.moderatorId),
		index("moderation_case_event_action_idx").on(table.action),
	]
);
