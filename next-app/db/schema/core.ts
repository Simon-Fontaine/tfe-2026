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
	lfgApplicationStatusEnum,
	lfgStatusEnum,
	lfgTypeEnum,
	mapTypeEnum,
	matchResultEnum,
	notificationTypeEnum,
	ocrJobStatusEnum,
	orgRoleEnum,
	ow2RankEnum,
	ow2RoleEnum,
	rosterStatusEnum,
	scrimStatusEnum,
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

		/**
		 * Internal SR computed from scrim results on this platform. Starts at 1500.
		 * Updated only after both teams confirm a scrim result.
		 */
		internalSr: integer("internal_sr").notNull().default(1500),

		/** Glicko-2 rating deviation. */
		srDeviation: integer("sr_deviation").notNull().default(350),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("player_profile_user_idx").on(table.userId),
		index("player_profile_battletag_idx").on(table.battletag),
		// LFG query: "find all support players in diamond+ with SR > X"
		index("player_profile_lfg_idx").on(table.primaryRole, table.rank, table.internalSr),
		// Matchmaking: fast SR-range lookups
		index("player_profile_sr_idx").on(table.internalSr),
	]
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

		/** Org creator. Denormalized for fast access. */
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "restrict" }),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [uniqueIndex("organization_slug_idx").on(table.slug)]
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
		role: orgRoleEnum("role").notNull().default("player"),

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
 * A competitive roster owned by an organization. `teamSr` is a composite rating
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

		/** Composite team SR for matchmaking. */
		teamSr: integer("team_sr").notNull().default(1500),
		srDeviation: integer("sr_deviation").notNull().default(350),

		/** Completed scrim count for SR calibration. */
		matchesPlayed: integer("matches_played").notNull().default(0),

		/** Archived teams are hidden from matchmaking. */
		isArchived: boolean("is_archived").notNull().default(false),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("team_org_idx").on(table.organizationId),
		// Matchmaking: "find active teams in SR range"
		index("team_matchmaking_idx").on(table.teamSr, table.isArchived),
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
		roleInTeam: ow2RoleEnum("role_in_team").notNull(),
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

// ============================================================================
// LFG POSTS — Bidirectional Looking-For-Group
// ============================================================================

/**
 * Bidirectional LFG posts. `team_seeking_player` sets `teamId`; `player_seeking_team`
 * leaves it null. `heroPoolFilter` uses a GIN index for hero-based matching.
 */
export const lfgPostTable = pgTable(
	"lfg_post",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		type: lfgTypeEnum("type").notNull(),
		status: lfgStatusEnum("status").notNull().default("open"),

		/** User who created the post. */
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Set only for team_seeking_player posts. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "cascade" }),

		/** Target roles as JSONB array. */
		rolesNeeded: jsonb("roles_needed").$type<string[]>().notNull().default([]),

		/** Minimum acceptable rank tier. */
		minRank: ow2RankEnum("min_rank"),

		/** Maximum acceptable rank tier. */
		maxRank: ow2RankEnum("max_rank"),

		/** Minimum internal SR. */
		minSr: integer("min_sr"),

		/** Maximum internal SR. */
		maxSr: integer("max_sr"),

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
		// Primary LFG feed query: open posts of a given type
		index("lfg_feed_idx").on(table.type, table.status),
		// Filter by role + rank range for the "find me a support" queries
		index("lfg_role_rank_idx").on(table.status, table.minRank, table.maxRank),
		// SR-range matching for internal matchmaking-aware LFG
		index("lfg_sr_range_idx").on(table.status, table.minSr, table.maxSr),
		// My posts
		index("lfg_user_idx").on(table.userId),
		index("lfg_team_idx").on(table.teamId),
	]
);

/** Applications and responses to LFG posts, from players or teams. */
export const lfgApplicationTable = pgTable(
	"lfg_application",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		postId: uuid("post_id")
			.notNull()
			.references(() => lfgPostTable.id, { onDelete: "cascade" }),

		/** User who is applying or reaching out. */
		applicantUserId: uuid("applicant_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

		/** Applicant team for team-initiated outreach. */
		applicantTeamId: uuid("applicant_team_id").references(() => teamTable.id, {
			onDelete: "cascade",
		}),

		message: text("message"),
		status: lfgApplicationStatusEnum("status").notNull().default("pending"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// Prevent duplicate applications
		uniqueIndex("lfg_app_unique_idx").on(table.postId, table.applicantUserId),
		index("lfg_app_post_idx").on(table.postId),
		index("lfg_app_user_idx").on(table.applicantUserId),
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
		index("availability_schedule_idx").on(table.userId, table.dayOfWeek),
		index("availability_specific_idx").on(table.userId, table.specificDate),
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

		/** SR delta applied after confirmation. */
		srDelta: integer("sr_delta"),

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

		/** User who created this scrim request. */
		createdByUserId: uuid("created_by_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "restrict" }),

		/** Optional message from the requester. */
		message: text("message"),

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
	]
);

// ============================================================================
// SCRIM CONFIRMATIONS — Both teams must confirm before SR is updated
// ============================================================================

/**
 * Post-scrim result confirmation. One row per team per scrim. Both teams must
 * confirm before SR is updated; a dispute from either side triggers admin review.
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
		side: text("side").notNull(), // "home" | "away"

		/** Resolved platform user. Null for unregistered opponents. */
		userId: uuid("user_id").references(() => userTable.id, { onDelete: "set null" }),

		/** Platform team. Null for unregistered opponents. */
		teamId: uuid("team_id").references(() => teamTable.id, { onDelete: "set null" }),

		/** Raw player name from OCR. */
		playerName: text("player_name").notNull(),

		/** Hero played on this map. */
		hero: text("hero").notNull(),

		/** Role played on this map. */
		role: ow2RoleEnum("role").notNull(),

		// ---- Core stat columns (direct from OCR) ----
		eliminations: integer("eliminations").notNull().default(0),
		assists: integer("assists").notNull().default(0),
		deaths: integer("deaths").notNull().default(0),
		damage: integer("damage").notNull().default(0),
		healing: integer("healing").notNull().default(0),
		mitigation: integer("mitigation").notNull().default(0),

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
// SR HISTORY — Audit trail for internal rating changes
// ============================================================================

/**
 * Immutable SR change log for both players and teams. `entityType` + `entityId`
 * form a polymorphic reference to either `playerProfile.id` or `team.id`.
 */
export const srHistoryTable = pgTable(
	"sr_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		/** "player" or "team". */
		entityType: text("entity_type").notNull(),

		/** UUID of the player_profile or team row. */
		entityId: uuid("entity_id").notNull(),

		/** Scrim that triggered this SR change. */
		scrimId: uuid("scrim_id")
			.notNull()
			.references(() => scrimTable.id, { onDelete: "cascade" }),

		srBefore: integer("sr_before").notNull(),
		srAfter: integer("sr_after").notNull(),
		srDelta: integer("sr_delta").notNull(),

		/** Deviation before and after (Glicko-2). */
		deviationBefore: integer("deviation_before"),
		deviationAfter: integer("deviation_after"),

		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("sr_history_entity_idx").on(table.entityType, table.entityId),
		index("sr_history_scrim_idx").on(table.scrimId),
		// Timeline query: "show my SR graph"
		index("sr_history_timeline_idx").on(table.entityType, table.entityId, table.createdAt),
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
		submittedByUserId: uuid("submitted_by_user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "restrict" }),

		/** Screenshot type: "game_history" or "scoreboard". */
		screenshotType: text("screenshot_type").notNull(),

		/** Image URL in object storage. */
		imageUrl: text("image_url").notNull(),

		status: ocrJobStatusEnum("status").notNull().default("queued"),

		/** Full OCR JSON response for audit and re-processing. */
		rawOcrOutput: jsonb("raw_ocr_output"),

		/** Error message if the job failed. */
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
		referenceType: text("reference_type"), // "scrim" | "lfg_post" | "lfg_application" | etc.
		referenceId: uuid("reference_id"),

		isRead: boolean("is_read").notNull().default(false),

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
 * `teamId`, `lfgApplicationId`) is set per channel. Archived channels are
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
		lfgApplicationId: uuid("lfg_application_id").references(() => lfgApplicationTable.id, {
			onDelete: "cascade",
		}),

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
		index("chat_channel_lfg_app_idx").on(table.lfgApplicationId),
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
		senderId: uuid("sender_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),

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
