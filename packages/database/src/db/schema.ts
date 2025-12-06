import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Types and JSON payload shapes

export type GameConfig = {
  roles: string[];
  modes: {
    slug: string;
    name: string;
    teamSize: number;
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

// Enum definitions

export const globalRoleEnum = pgEnum("global_role", ["admin", "staff", "user"]);
export const providerEnum = pgEnum("provider_type", [
  "steam",
  "discord",
  "riot",
  "twitch",
  "battle_net",
]);

export const orgRoleEnum = pgEnum("org_role", [
  "owner",
  "admin",
  "manager",
  "member",
]);

export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "captain",
  "player",
  "coach",
]);

export const scrimStatusEnum = pgEnum("scrim_status", [
  "DRAFT",
  "PENDING",
  "CONFIRMED",
  "LIVE",
  "PROCESSING",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
]);

export const scrimFormatEnum = pgEnum("scrim_format", [
  "BO1",
  "BO2",
  "BO3",
  "BO5",
  "BO7",
]);

export const eloReasonEnum = pgEnum("elo_reason", [
  "match",
  "penalty",
  "decay",
  "rollback",
]);

export const requestTypeEnum = pgEnum("request_type", ["SEARCH", "OFFER"]);

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const verificationTypeEnum = pgEnum("verification_type", [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
  "ACCOUNT_DELETION",
  "EMAIL_CHANGE",
]);

// Identity and security tables

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    pendingEmail: varchar("pending_email", { length: 255 }),

    username: varchar("username", { length: 30 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    avatarUrl: text("avatar_url"),
    country: varchar("country", { length: 2 }),
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

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

    deletedAt: timestamp("deleted_at"), // Soft delete marker
  },
  (t) => [
    index("users_username_idx").on(t.username),
    index("users_email_idx").on(t.email),
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

// Organization tables

export const organizationsTable = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    config: jsonb("config").default({ timezone: "UTC" }).notNull(),
    logoUrl: text("logo_url"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),

    deletedAt: timestamp("deleted_at"), // Soft delete marker
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

// Game, team, and roster tables

export const gamesTable = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  logoUrl: text("logo_url"),
  metadata: jsonb("metadata").$type<GameConfig>().notNull(),
  statSchema: jsonb("stat_schema").$type<StatSchema>().notNull(),
});

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

export const teamsTable = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizationsTable.id, { onDelete: "cascade" })
      .notNull(),
    gameId: uuid("game_id")
      .references(() => gamesTable.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    acronym: varchar("acronym", { length: 10 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),

    deletedAt: timestamp("deleted_at"), // Soft delete marker
  },
  (t) => [
    index("teams_active_idx")
      .on(t.organizationId)
      .where(sql`${t.deletedAt} IS NULL`),
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
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("availability_idx").on(t.teamId, t.dayOfWeek)],
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
    ingameRole: varchar("ingame_role", { length: 50 }),
    startDate: timestamp("start_date").defaultNow().notNull(),
    endDate: timestamp("end_date"), // Null means currently on the roster
  },
  (t) => [index("active_roster_idx").on(t.teamId, t.endDate)],
);

// Scrims and matchmaking tables

export const scrimsTable = pgTable(
  "scrims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => gamesTable.id)
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizationsTable.id, { onDelete: "cascade" })
      .notNull(),
    opponentOrganizationId: uuid("opponent_organization_id").references(
      () => organizationsTable.id,
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"), // Soft delete marker
  },
  (t) => [
    index("scrim_calendar_idx").on(t.scheduledStart, t.status),
    index("scrim_host_org_idx").on(t.organizationId),
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
    screenshotUrl: text("screenshot_url"),
    rawOcrData: jsonb("raw_ocr_data"),
  },
  (t) => [index("scrim_game_idx").on(t.scrimId)],
);

// Player stats and Elo history

export const playerGameStatsTable = pgTable(
  "player_game_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scrimGameId: uuid("scrim_game_id")
      .references(() => scrimGamesTable.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => usersTable.id)
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teamsTable.id)
      .notNull(),
    isSubstitute: boolean("is_substitute").default(false).notNull(),
    rolePlayed: varchar("role_played", { length: 50 }),
    won: boolean("won").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => [
    uniqueIndex("unique_stat_per_game").on(t.scrimGameId, t.userId),
    index("stats_data_gin_idx").using("gin", t.data),
  ],
);

export const eloHistoryTable = pgTable("elo_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teamsTable.id)
    .notNull(),
  gameId: uuid("game_id")
    .references(() => gamesTable.id)
    .notNull(),
  scrimId: uuid("scrim_id").references(() => scrimsTable.id),
  oldRating: integer("old_rating").notNull(),
  newRating: integer("new_rating").notNull(),
  change: integer("change").notNull(),
  reason: eloReasonEnum("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Matchmaking requests

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

    status: varchar("status", { length: 20 }).default("ACTIVE").notNull(),
    note: text("note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("scrim_req_main_idx").on(t.gameId, t.status, t.date),
    index("scrim_req_elo_idx").on(t.minElo, t.maxElo),
  ],
);

// Messaging and audit

export const scrimMessagesTable = pgTable("scrim_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  scrimId: uuid("scrim_id")
    .references(() => scrimsTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => usersTable.id)
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  userId: uuid("user_id").references(() => usersTable.id),
  organizationId: uuid("organization_id").references(
    () => organizationsTable.id,
  ), // Tie audit to organization for multi-tenant

  action: varchar("action", { length: 100 }).notNull(),
  targetId: uuid("target_id"),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Drizzle relations

export const usersRelations = relations(usersTable, ({ many }) => ({
  connectedAccounts: many(connectedAccountsTable),
  orgMemberships: many(organizationMembersTable),
  teamMemberships: many(teamMembersTable),
  notifications: many(notificationsTable),
  verifications: many(verificationsTable),
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
  scrimRequests: many(scrimRequestsTable),
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
  games: many(scrimGamesTable),
  messages: many(scrimMessagesTable),
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
    stats: many(playerGameStatsTable),
  }),
);

export const playerGameStatsRelations = relations(
  playerGameStatsTable,
  ({ one }) => ({
    scrimGame: one(scrimGamesTable, {
      fields: [playerGameStatsTable.scrimGameId],
      references: [scrimGamesTable.id],
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
