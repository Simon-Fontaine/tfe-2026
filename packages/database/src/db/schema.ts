import {
  AVAILABILITY_STATUSES,
  DAYS_OF_WEEK,
  ELO_REASONS,
  FLAG_SEVERITIES,
  GLOBAL_ROLES,
  INVITE_STATUSES,
  OCR_STATUSES,
  ORG_ROLES,
  PROVIDER_TYPES,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  SCRIM_FORMATS,
  SCRIM_PREFERENCE_TYPES,
  SCRIM_STATUSES,
  TEAM_ROLES,
  TEAM_ROSTER_STATUSES,
  VERIFICATION_STATUSES,
  VERIFICATION_TYPES,
} from "@workspaces/shared";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ----------------------------------------------------------------------
// 1. Types & Config
// ----------------------------------------------------------------------

export type GameConfig = {
  roles: string[]; // e.g. ["Tank", "Damage", "Support"]
  modes: {
    slug: string;
    name: string; // e.g. "Escort", "Control"
    teamSize: number; // e.g. 5
    allowedMaps: string[];
  }[];
};

export type StatSchema = {
  label: string;
  key: string;
  type: "number" | "boolean" | "duration";
}[];

export type UserNotificationPreferences = {
  email_match_found: boolean;
  email_scrim_reminder: boolean;
  push_new_message: boolean;
};

// ----------------------------------------------------------------------
// 2. Enums
// ----------------------------------------------------------------------

export const globalRoleEnum = pgEnum("global_role", GLOBAL_ROLES);
export const providerEnum = pgEnum("provider_type", PROVIDER_TYPES);

export const orgRoleEnum = pgEnum("org_role", ORG_ROLES);

export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);

export const teamRosterStatusEnum = pgEnum(
  "team_roster_status",
  TEAM_ROSTER_STATUSES,
);

export const scrimStatusEnum = pgEnum("scrim_status", SCRIM_STATUSES);

export const scrimFormatEnum = pgEnum("scrim_format", SCRIM_FORMATS);

export const eloReasonEnum = pgEnum("elo_reason", ELO_REASONS);

export const requestTypeEnum = pgEnum("request_type", REQUEST_TYPES);

export const dayOfWeekEnum = pgEnum("day_of_week", DAYS_OF_WEEK);

export const availabilityStatusEnum = pgEnum(
  "availability_status",
  AVAILABILITY_STATUSES,
);

export const verificationTypeEnum = pgEnum(
  "verification_type",
  VERIFICATION_TYPES,
);

export const scrimPreferenceTypeEnum = pgEnum(
  "scrim_preference_type",
  SCRIM_PREFERENCE_TYPES,
);

export const inviteStatusEnum = pgEnum("invite_status", INVITE_STATUSES);

export const requestStatusEnum = pgEnum("request_status", REQUEST_STATUSES);

export const ocrStatusEnum = pgEnum("ocr_status", OCR_STATUSES);

export const verificationStatusEnum = pgEnum(
  "verification_status",
  VERIFICATION_STATUSES,
);

export const flagSeverityEnum = pgEnum("flag_severity", FLAG_SEVERITIES);

// ----------------------------------------------------------------------
// 3. Identity
// ----------------------------------------------------------------------

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    pendingEmail: varchar("pending_email", { length: 255 }),

    username: varchar("username", { length: 30 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    avatarUrl: text("avatar_url"),
    country: varchar("country", { length: 2 }),
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    elo: integer("elo").default(1200).notNull(),

    isVerified: boolean("is_verified").default(false).notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),

    globalRole: globalRoleEnum("global_role").default("user").notNull(),
    settings: jsonb("settings").$type<UserNotificationPreferences>().default({
      email_match_found: true,
      email_scrim_reminder: true,
      push_new_message: true,
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),

    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    uniqueIndex("users_email_unique_active")
      .on(t.email)
      .where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex("users_username_unique_active")
      .on(t.username)
      .where(sql`${t.deletedAt} IS NULL`),
    index("users_elo_idx").on(t.elo),
  ],
);

export const verificationsTable = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    type: verificationTypeEnum("type").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("verification_token_idx").on(t.token),
    index("verification_user_idx").on(t.userId),
  ],
);

export const connectedAccountsTable = pgTable(
  "connected_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    provider: providerEnum("provider").notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("provider_acc_unique").on(t.provider, t.providerAccountId),
    index("connected_acc_user_idx").on(t.userId),
  ],
);

// ----------------------------------------------------------------------
// 4. Organization Multi-tenancy
// ----------------------------------------------------------------------

export const organizationsTable = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    config: jsonb("config").default({ timezone: "UTC" }).notNull(),
    logoUrl: text("logo_url"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),

    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("orgs_active_slug_idx").on(t.slug).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const organizationMembersTable = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizationsTable.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    role: orgRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("unique_org_member").on(t.organizationId, t.userId)],
);

// ----------------------------------------------------------------------
// 5. Game Metadata
// ----------------------------------------------------------------------

export const gamesTable = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  logoUrl: text("logo_url"),
  metadata: jsonb("metadata").$type<GameConfig>().notNull(),
  statSchema: jsonb("stat_schema").$type<StatSchema>().notNull(),
  statSchemaVersion: integer("stat_schema_version").default(1).notNull(),
});

export const gameStatTemplatesTable = pgTable(
  "game_stat_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => gamesTable.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    schema: jsonb("schema").$type<StatSchema>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("game_stat_template_version").on(t.gameId, t.version)],
);

export const mapsTable = pgTable(
  "maps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => gamesTable.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    imageUrl: text("image_url").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (t) => [uniqueIndex("unique_map_slug_per_game").on(t.gameId, t.slug)],
);

// ----------------------------------------------------------------------
// 6. Teams & Roster Logic
// ----------------------------------------------------------------------

export const teamsTable = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizationsTable.id, { onDelete: "restrict" })
      .notNull(),
    gameId: uuid("game_id")
      .references(() => gamesTable.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    acronym: varchar("acronym", { length: 10 }).notNull(),

    cachedCompositeElo: integer("cached_composite_elo").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),

    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("teams_active_idx")
      .on(t.organizationId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("teams_elo_idx").on(t.gameId, t.cachedCompositeElo),
  ],
);

export const teamMembersTable = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),

    role: teamRoleEnum("role").default("player").notNull(),
    rosterStatus: teamRosterStatusEnum("roster_status")
      .default("SUBSTITUTE")
      .notNull(),
    ingameRole: varchar("ingame_role", { length: 50 }),

    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    leftAt: timestamp("left_at"),
  },
  (t) => [
    index("active_roster_idx")
      .on(t.teamId, t.rosterStatus)
      .where(sql`${t.leftAt} IS NULL`),
    index("member_history_idx").on(t.userId, t.teamId),
  ],
);

export const teamAvailabilitiesTable = pgTable(
  "team_availabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    // IMPORTANT: Always stored in UTC.
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("availability_idx").on(t.teamId, t.dayOfWeek)],
);

export const teamBlackoutsTable = pgTable(
  "team_blackouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("team_blackout_range_idx").on(t.teamId, t.startAt)],
);

export const teamScrimPreferencesTable = pgTable(
  "team_scrim_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    targetOrganizationId: uuid("target_organization_id").references(
      () => organizationsTable.id,
      { onDelete: "cascade" },
    ),
    targetTeamId: uuid("target_team_id").references(() => teamsTable.id, {
      onDelete: "set null",
    }),
    preference: scrimPreferenceTypeEnum("preference").notNull(),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("team_scrim_pref_unique").on(
      t.teamId,
      t.targetOrganizationId,
      t.targetTeamId,
      t.preference,
    ),
  ],
);

export const playerAvailabilitiesTable = pgTable(
  "player_availabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    // IMPORTANT: Always stored in UTC.
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    status: availabilityStatusEnum("status").default("AVAILABLE").notNull(),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("player_availability_unique").on(
      t.teamId,
      t.userId,
      t.dayOfWeek,
      t.startTime,
      t.endTime,
    ),
    index("player_availability_lookup_idx").on(t.teamId, t.dayOfWeek),
  ],
);

export const playerAvailabilityExceptionsTable = pgTable(
  "player_availability_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: availabilityStatusEnum("status").default("UNAVAILABLE").notNull(),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("player_availability_exception_idx").on(
      t.teamId,
      t.userId,
      t.startAt,
    ),
  ],
);

export const teamInvitesTable = pgTable(
  "team_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    invitedUserId: uuid("invited_user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    role: teamRoleEnum("role").default("player").notNull(),
    message: varchar("message", { length: 255 }),
    token: varchar("token", { length: 128 }).notNull(),
    status: inviteStatusEnum("status").default("PENDING").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("team_invite_token_unique").on(t.token),
    index("team_invite_lookup_idx").on(t.teamId, t.invitedUserId, t.status),
  ],
);

export const teamRosterLocksTable = pgTable(
  "team_roster_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    enforcedByUserId: uuid("enforced_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("team_roster_lock_idx").on(t.teamId, t.startsAt)],
);

export const teamRoleLimitsTable = pgTable(
  "team_role_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    role: teamRoleEnum("role").notNull(),
    maxCount: integer("max_count").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("team_role_limit_unique").on(t.teamId, t.role)],
);

// ----------------------------------------------------------------------
// 7. Scrims & Gameplay
// ----------------------------------------------------------------------

export const scrimsTable = pgTable(
  "scrims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => gamesTable.id)
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizationsTable.id, { onDelete: "restrict" })
      .notNull(),
    opponentOrganizationId: uuid("opponent_organization_id").references(
      () => organizationsTable.id,
      { onDelete: "set null" },
    ),
    fromRequestId: uuid("from_request_id"),

    opponentName: varchar("opponent_name"),
    title: varchar("title", { length: 255 }),
    scheduledStart: timestamp("scheduled_start", {
      withTimezone: true,
    }).notNull(),

    format: scrimFormatEnum("format").default("BO1").notNull(),
    status: scrimStatusEnum("status").default("DRAFT").notNull(),
    cancellationReason: text("cancellation_reason"),

    serverConnectionString: text("server_connection_string"),
    winnerParticipantId: uuid("winner_participant_id"),

    version: integer("version").default(1).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("scrim_calendar_idx").on(t.scheduledStart, t.status),
    index("scrim_host_org_idx").on(t.organizationId),
  ],
);

export const scrimMessagesTable = pgTable("scrim_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  scrimId: uuid("scrim_id")
    .references(() => scrimsTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "set null" })
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scrimParticipantsTable = pgTable(
  "scrim_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimId: uuid("scrim_id")
      .references(() => scrimsTable.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "restrict" })
      .notNull(),
    isHost: boolean("is_host").default(false).notNull(),
    finalScore: integer("final_score").default(0).notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    forfeited: boolean("forfeited").default(false).notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("scrim_participant_unique").on(t.scrimId, t.teamId),
    index("scrim_participant_scrim_idx").on(t.scrimId),
  ],
);

export const scrimLineupsTable = pgTable(
  "scrim_lineups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimParticipantId: uuid("scrim_participant_id")
      .references(() => scrimParticipantsTable.id, { onDelete: "cascade" })
      .notNull(),
    teamMemberId: uuid("team_member_id").references(() => teamMembersTable.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "restrict" })
      .notNull(),
    isSubstitute: boolean("is_substitute").default(false).notNull(),
    rolePlayed: varchar("role_played", { length: 50 }),

    lastReadMessageId: uuid("last_read_message_id").references(
      () => scrimMessagesTable.id,
      { onDelete: "set null" },
    ),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("scrim_lineup_unique").on(t.scrimParticipantId, t.userId),
    index("scrim_lineup_participant_idx").on(t.scrimParticipantId),
  ],
);

export const scrimGamesTable = pgTable(
  "scrim_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimId: uuid("scrim_id")
      .references(() => scrimsTable.id, { onDelete: "cascade" })
      .notNull(),
    mapId: uuid("map_id")
      .references(() => mapsTable.id)
      .notNull(),
    mode: varchar("mode", { length: 50 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    status: scrimStatusEnum("status").default("COMPLETED").notNull(),
    winnerParticipantId: uuid("winner_participant_id").references(
      () => scrimParticipantsTable.id,
      { onDelete: "set null" },
    ),
    screenshotUrl: text("screenshot_url"),
    rawOcrData: jsonb("raw_ocr_data"),
  },
  (t) => [index("scrim_game_idx").on(t.scrimId)],
);

export const scrimGameScreenshotsTable = pgTable(
  "scrim_game_screenshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimGameId: uuid("scrim_game_id")
      .references(() => scrimGamesTable.id, { onDelete: "cascade" })
      .notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .references(() => usersTable.id, { onDelete: "set null" })
      .notNull(),
    fileUrl: text("file_url").notNull(),
    ocrStatus: ocrStatusEnum("ocr_status").default("PENDING").notNull(),
    ocrConfidence: real("ocr_confidence"),
    extractedData: jsonb("extracted_data"),
    rawOcrText: text("raw_ocr_text"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("scrim_game_screenshot_idx").on(t.scrimGameId, t.ocrStatus)],
);

export const scrimChecklistsTable = pgTable(
  "scrim_checklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimId: uuid("scrim_id")
      .references(() => scrimsTable.id, { onDelete: "cascade" })
      .notNull(),
    label: varchar("label", { length: 150 }).notNull(),
    required: boolean("required").default(true).notNull(),
    completed: boolean("completed").default(false).notNull(),
    completedByUserId: uuid("completed_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("scrim_checklist_idx").on(t.scrimId, t.required)],
);

export const scrimModerationFlagsTable = pgTable(
  "scrim_moderation_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimId: uuid("scrim_id")
      .references(() => scrimsTable.id, { onDelete: "cascade" })
      .notNull(),
    raisedByUserId: uuid("raised_by_user_id")
      .references(() => usersTable.id, { onDelete: "set null" })
      .notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    severity: flagSeverityEnum("severity").default("MEDIUM").notNull(),
    resolved: boolean("resolved").default(false).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: varchar("resolution_note", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("scrim_flag_idx").on(t.scrimId, t.resolved)],
);

export const scrimResultVerificationsTable = pgTable(
  "scrim_result_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimId: uuid("scrim_id")
      .references(() => scrimsTable.id, { onDelete: "cascade" })
      .notNull(),
    submittedByUserId: uuid("submitted_by_user_id")
      .references(() => usersTable.id, { onDelete: "set null" })
      .notNull(),
    status: verificationStatusEnum("status").default("PENDING").notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [index("scrim_result_verify_idx").on(t.scrimId, t.status)],
);

// ----------------------------------------------------------------------
// 8. Stats & History
// ----------------------------------------------------------------------

export const playerGameStatsTable = pgTable(
  "player_game_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimGameId: uuid("scrim_game_id")
      .references(() => scrimGamesTable.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "restrict" })
      .notNull(),
    scrimParticipantId: uuid("scrim_participant_id")
      .references(() => scrimParticipantsTable.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "set null" })
      .notNull(),

    isSubstitute: boolean("is_substitute").default(false).notNull(),
    rolePlayed: varchar("role_played", { length: 50 }),
    won: boolean("won").notNull(),
    stats: jsonb("stats").notNull(),
  },
  (t) => [
    uniqueIndex("unique_stat_per_game").on(t.scrimGameId, t.userId),
    index("stats_user_history_idx").on(t.userId, t.scrimGameId),
    index("stats_data_gin_idx").on(t.stats),
  ],
);

export const eloHistoryTable = pgTable("elo_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "restrict" })
    .notNull(),
  teamId: uuid("team_id").references(() => teamsTable.id, {
    onDelete: "set null",
  }),
  gameId: uuid("game_id")
    .references(() => gamesTable.id)
    .notNull(),
  scrimId: uuid("scrim_id").references(() => scrimsTable.id, {
    onDelete: "set null",
  }),
  oldElo: integer("old_elo").notNull(),
  newElo: integer("new_elo").notNull(),
  change: integer("change").notNull(),
  reason: eloReasonEnum("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ----------------------------------------------------------------------
// 9. Matchmaking Requests
// ----------------------------------------------------------------------

export const scrimRequestsTable = pgTable(
  "scrim_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id, { onDelete: "cascade" })
      .notNull(),
    gameId: uuid("game_id")
      .references(() => gamesTable.id)
      .notNull(),

    type: requestTypeEnum("type").default("SEARCH").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").default(120).notNull(),

    minElo: integer("min_elo").default(0).notNull(),
    maxElo: integer("max_elo").default(5000).notNull(),

    preferredMaps: jsonb("preferred_maps").$type<string[]>(),
    serverRegion: varchar("server_region", { length: 50 }),
    status: requestStatusEnum("status").default("ACTIVE").notNull(),
    note: text("note"),

    version: integer("version").default(1).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("scrim_req_search_idx").on(
      t.status,
      t.gameId,
      t.minElo,
      t.maxElo,
      t.date,
    ),
  ],
);

// ----------------------------------------------------------------------
// 10. Audit & Notifications
// ----------------------------------------------------------------------

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    data: jsonb("data"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("unread_notifs_idx").on(t.userId).where(sql`${t.readAt} IS NULL`),
  ],
);

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  organizationId: uuid("organization_id").references(
    () => organizationsTable.id,
    { onDelete: "set null" },
  ),
  action: varchar("action", { length: 100 }).notNull(),
  targetId: uuid("target_id"),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ----------------------------------------------------------------------
// 11. Relations
// ----------------------------------------------------------------------

export const usersRelations = relations(usersTable, ({ many }) => ({
  connectedAccounts: many(connectedAccountsTable),
  orgMemberships: many(organizationMembersTable),
  teamMemberships: many(teamMembersTable),
  notifications: many(notificationsTable),
  verifications: many(verificationsTable),
  playerAvailabilities: many(playerAvailabilitiesTable),
  playerAvailabilityExceptions: many(playerAvailabilityExceptionsTable),
  sentTeamInvites: many(teamInvitesTable, { relationName: "sentInvites" }),
  receivedTeamInvites: many(teamInvitesTable, {
    relationName: "receivedInvites",
  }),
  eloHistory: many(eloHistoryTable),
}));

export const verificationsRelations = relations(
  verificationsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [verificationsTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const connectedAccountsRelations = relations(
  connectedAccountsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [connectedAccountsTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const organizationsRelations = relations(
  organizationsTable,
  ({ many }) => ({
    members: many(organizationMembersTable),
    teams: many(teamsTable),
    hostedScrims: many(scrimsTable, { relationName: "hostOrg" }),
  }),
);

export const organizationMembersRelations = relations(
  organizationMembersTable,
  ({ one }) => ({
    organization: one(organizationsTable, {
      fields: [organizationMembersTable.organizationId],
      references: [organizationsTable.id],
    }),
    user: one(usersTable, {
      fields: [organizationMembersTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const gamesRelations = relations(gamesTable, ({ many }) => ({
  maps: many(mapsTable),
  teams: many(teamsTable),
  statTemplates: many(gameStatTemplatesTable),
}));

export const teamsRelations = relations(teamsTable, ({ one, many }) => ({
  organization: one(organizationsTable, {
    fields: [teamsTable.organizationId],
    references: [organizationsTable.id],
  }),
  game: one(gamesTable, {
    fields: [teamsTable.gameId],
    references: [gamesTable.id],
  }),
  members: many(teamMembersTable),
  availabilities: many(teamAvailabilitiesTable),
  playerAvailabilities: many(playerAvailabilitiesTable),
  playerAvailabilityExceptions: many(playerAvailabilityExceptionsTable),
  blackouts: many(teamBlackoutsTable),
  scrimPreferences: many(teamScrimPreferencesTable, {
    relationName: "scrimPreferenceOwner",
  }),
  incomingScrimPreferences: many(teamScrimPreferencesTable, {
    relationName: "scrimPreferenceTarget",
  }),
  invites: many(teamInvitesTable),
  rosterLocks: many(teamRosterLocksTable),
  roleLimits: many(teamRoleLimitsTable),
  scrimRequests: many(scrimRequestsTable),
  scrimParticipants: many(scrimParticipantsTable),
}));

export const teamAvailabilitiesRelations = relations(
  teamAvailabilitiesTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [teamAvailabilitiesTable.teamId],
      references: [teamsTable.id],
    }),
  }),
);

export const teamMembersRelations = relations(teamMembersTable, ({ one }) => ({
  team: one(teamsTable, {
    fields: [teamMembersTable.teamId],
    references: [teamsTable.id],
  }),
  user: one(usersTable, {
    fields: [teamMembersTable.userId],
    references: [usersTable.id],
  }),
}));

export const scrimsRelations = relations(scrimsTable, ({ one, many }) => ({
  hostOrg: one(organizationsTable, {
    fields: [scrimsTable.organizationId],
    references: [organizationsTable.id],
    relationName: "hostOrg",
  }),
  opponentOrg: one(organizationsTable, {
    fields: [scrimsTable.opponentOrganizationId],
    references: [organizationsTable.id],
    relationName: "opponentOrg",
  }),
  game: one(gamesTable, {
    fields: [scrimsTable.gameId],
    references: [gamesTable.id],
  }),
  request: one(scrimRequestsTable, {
    fields: [scrimsTable.fromRequestId],
    references: [scrimRequestsTable.id],
  }),
  winnerParticipant: one(scrimParticipantsTable, {
    fields: [scrimsTable.winnerParticipantId],
    references: [scrimParticipantsTable.id],
  }),
  participants: many(scrimParticipantsTable),
  games: many(scrimGamesTable),
  messages: many(scrimMessagesTable),
  checklists: many(scrimChecklistsTable),
  moderationFlags: many(scrimModerationFlagsTable),
  resultVerifications: many(scrimResultVerificationsTable),
}));

export const scrimMessagesRelations = relations(
  scrimMessagesTable,
  ({ one }) => ({
    scrim: one(scrimsTable, {
      fields: [scrimMessagesTable.scrimId],
      references: [scrimsTable.id],
    }),
    user: one(usersTable, {
      fields: [scrimMessagesTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const scrimGamesRelations = relations(
  scrimGamesTable,
  ({ one, many }) => ({
    scrim: one(scrimsTable, {
      fields: [scrimGamesTable.scrimId],
      references: [scrimsTable.id],
    }),
    map: one(mapsTable, {
      fields: [scrimGamesTable.mapId],
      references: [mapsTable.id],
    }),
    winner: one(scrimParticipantsTable, {
      fields: [scrimGamesTable.winnerParticipantId],
      references: [scrimParticipantsTable.id],
    }),
    stats: many(playerGameStatsTable),
    screenshots: many(scrimGameScreenshotsTable),
  }),
);

export const playerGameStatsRelations = relations(
  playerGameStatsTable,
  ({ one }) => ({
    scrimGame: one(scrimGamesTable, {
      fields: [playerGameStatsTable.scrimGameId],
      references: [scrimGamesTable.id],
    }),
    scrimParticipant: one(scrimParticipantsTable, {
      fields: [playerGameStatsTable.scrimParticipantId],
      references: [scrimParticipantsTable.id],
    }),
    user: one(usersTable, {
      fields: [playerGameStatsTable.userId],
      references: [usersTable.id],
    }),
    team: one(teamsTable, {
      fields: [playerGameStatsTable.teamId],
      references: [teamsTable.id],
    }),
  }),
);

export const gameStatTemplatesRelations = relations(
  gameStatTemplatesTable,
  ({ one }) => ({
    game: one(gamesTable, {
      fields: [gameStatTemplatesTable.gameId],
      references: [gamesTable.id],
    }),
  }),
);

export const playerAvailabilitiesRelations = relations(
  playerAvailabilitiesTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [playerAvailabilitiesTable.teamId],
      references: [teamsTable.id],
    }),
    user: one(usersTable, {
      fields: [playerAvailabilitiesTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const playerAvailabilityExceptionsRelations = relations(
  playerAvailabilityExceptionsTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [playerAvailabilityExceptionsTable.teamId],
      references: [teamsTable.id],
    }),
    user: one(usersTable, {
      fields: [playerAvailabilityExceptionsTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const scrimParticipantsRelations = relations(
  scrimParticipantsTable,
  ({ one, many }) => ({
    scrim: one(scrimsTable, {
      fields: [scrimParticipantsTable.scrimId],
      references: [scrimsTable.id],
    }),
    team: one(teamsTable, {
      fields: [scrimParticipantsTable.teamId],
      references: [teamsTable.id],
    }),
    lineups: many(scrimLineupsTable),
    stats: many(playerGameStatsTable),
  }),
);

export const scrimLineupsRelations = relations(
  scrimLineupsTable,
  ({ one }) => ({
    participant: one(scrimParticipantsTable, {
      fields: [scrimLineupsTable.scrimParticipantId],
      references: [scrimParticipantsTable.id],
    }),
    teamMember: one(teamMembersTable, {
      fields: [scrimLineupsTable.teamMemberId],
      references: [teamMembersTable.id],
    }),
    user: one(usersTable, {
      fields: [scrimLineupsTable.userId],
      references: [usersTable.id],
    }),
    lastReadMessage: one(scrimMessagesTable, {
      fields: [scrimLineupsTable.lastReadMessageId],
      references: [scrimMessagesTable.id],
    }),
  }),
);

export const teamBlackoutsRelations = relations(
  teamBlackoutsTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [teamBlackoutsTable.teamId],
      references: [teamsTable.id],
    }),
  }),
);

export const teamScrimPreferencesRelations = relations(
  teamScrimPreferencesTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [teamScrimPreferencesTable.teamId],
      references: [teamsTable.id],
      relationName: "scrimPreferenceOwner",
    }),
    targetOrganization: one(organizationsTable, {
      fields: [teamScrimPreferencesTable.targetOrganizationId],
      references: [organizationsTable.id],
    }),
    targetTeam: one(teamsTable, {
      fields: [teamScrimPreferencesTable.targetTeamId],
      references: [teamsTable.id],
      relationName: "scrimPreferenceTarget",
    }),
  }),
);

export const teamInvitesRelations = relations(teamInvitesTable, ({ one }) => ({
  team: one(teamsTable, {
    fields: [teamInvitesTable.teamId],
    references: [teamsTable.id],
  }),
  invitedUser: one(usersTable, {
    fields: [teamInvitesTable.invitedUserId],
    references: [usersTable.id],
    relationName: "receivedInvites",
  }),
  invitedByUser: one(usersTable, {
    fields: [teamInvitesTable.invitedByUserId],
    references: [usersTable.id],
    relationName: "sentInvites",
  }),
}));

export const teamRosterLocksRelations = relations(
  teamRosterLocksTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [teamRosterLocksTable.teamId],
      references: [teamsTable.id],
    }),
    enforcedBy: one(usersTable, {
      fields: [teamRosterLocksTable.enforcedByUserId],
      references: [usersTable.id],
    }),
  }),
);

export const teamRoleLimitsRelations = relations(
  teamRoleLimitsTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [teamRoleLimitsTable.teamId],
      references: [teamsTable.id],
    }),
  }),
);

export const scrimChecklistsRelations = relations(
  scrimChecklistsTable,
  ({ one }) => ({
    scrim: one(scrimsTable, {
      fields: [scrimChecklistsTable.scrimId],
      references: [scrimsTable.id],
    }),
    completedByUser: one(usersTable, {
      fields: [scrimChecklistsTable.completedByUserId],
      references: [usersTable.id],
    }),
  }),
);

export const scrimModerationFlagsRelations = relations(
  scrimModerationFlagsTable,
  ({ one }) => ({
    scrim: one(scrimsTable, {
      fields: [scrimModerationFlagsTable.scrimId],
      references: [scrimsTable.id],
    }),
    raisedBy: one(usersTable, {
      fields: [scrimModerationFlagsTable.raisedByUserId],
      references: [usersTable.id],
    }),
  }),
);

export const scrimResultVerificationsRelations = relations(
  scrimResultVerificationsTable,
  ({ one }) => ({
    scrim: one(scrimsTable, {
      fields: [scrimResultVerificationsTable.scrimId],
      references: [scrimsTable.id],
    }),
    submittedBy: one(usersTable, {
      fields: [scrimResultVerificationsTable.submittedByUserId],
      references: [usersTable.id],
    }),
    reviewedBy: one(usersTable, {
      fields: [scrimResultVerificationsTable.reviewedByUserId],
      references: [usersTable.id],
    }),
  }),
);

export const scrimGameScreenshotsRelations = relations(
  scrimGameScreenshotsTable,
  ({ one }) => ({
    scrimGame: one(scrimGamesTable, {
      fields: [scrimGameScreenshotsTable.scrimGameId],
      references: [scrimGamesTable.id],
    }),
    uploadedBy: one(usersTable, {
      fields: [scrimGameScreenshotsTable.uploadedByUserId],
      references: [usersTable.id],
    }),
  }),
);

export const mapsRelations = relations(mapsTable, ({ one }) => ({
  game: one(gamesTable, {
    fields: [mapsTable.gameId],
    references: [gamesTable.id],
  }),
}));

export const scrimRequestsRelations = relations(
  scrimRequestsTable,
  ({ one }) => ({
    team: one(teamsTable, {
      fields: [scrimRequestsTable.teamId],
      references: [teamsTable.id],
    }),
    game: one(gamesTable, {
      fields: [scrimRequestsTable.gameId],
      references: [gamesTable.id],
    }),
  }),
);

export const eloHistoryRelations = relations(eloHistoryTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [eloHistoryTable.userId],
    references: [usersTable.id],
  }),
  team: one(teamsTable, {
    fields: [eloHistoryTable.teamId],
    references: [teamsTable.id],
  }),
  game: one(gamesTable, {
    fields: [eloHistoryTable.gameId],
    references: [gamesTable.id],
  }),
  scrim: one(scrimsTable, {
    fields: [eloHistoryTable.scrimId],
    references: [scrimsTable.id],
  }),
}));

export const notificationsRelations = relations(
  notificationsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [notificationsTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [auditLogsTable.userId],
    references: [usersTable.id],
  }),
  organization: one(organizationsTable, {
    fields: [auditLogsTable.organizationId],
    references: [organizationsTable.id],
  }),
}));
