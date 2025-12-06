CREATE TYPE "public"."day_of_week" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');--> statement-breakpoint
CREATE TYPE "public"."elo_reason" AS ENUM('match', 'penalty', 'decay', 'rollback');--> statement-breakpoint
CREATE TYPE "public"."global_role" AS ENUM('admin', 'staff', 'user');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."provider_type" AS ENUM('steam', 'discord', 'riot', 'twitch', 'battle_net');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('SEARCH', 'OFFER');--> statement-breakpoint
CREATE TYPE "public"."scrim_format" AS ENUM('BO1', 'BO2', 'BO3', 'BO5', 'BO7');--> statement-breakpoint
CREATE TYPE "public"."scrim_status" AS ENUM('DRAFT', 'PENDING', 'CONFIRMED', 'LIVE', 'PROCESSING', 'COMPLETED', 'DISPUTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'captain', 'player', 'coach');--> statement-breakpoint
CREATE TYPE "public"."verification_type" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'ACCOUNT_DELETION', 'EMAIL_CHANGE');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"action" varchar(100) NOT NULL,
	"target_id" uuid,
	"details" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "provider_type" NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elo_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"scrim_id" uuid,
	"old_rating" integer NOT NULL,
	"new_rating" integer NOT NULL,
	"change" integer NOT NULL,
	"reason" "elo_reason" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_url" text,
	"metadata" jsonb NOT NULL,
	"stat_schema" jsonb NOT NULL,
	CONSTRAINT "games_name_unique" UNIQUE("name"),
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"image_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"config" jsonb DEFAULT '{"timezone":"UTC"}'::jsonb NOT NULL,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "player_game_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"is_substitute" boolean DEFAULT false NOT NULL,
	"role_played" varchar(50),
	"won" boolean NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"map_id" uuid NOT NULL,
	"mode" varchar(50) NOT NULL,
	"order_index" integer NOT NULL,
	"status" "scrim_status" DEFAULT 'COMPLETED' NOT NULL,
	"screenshot_url" text,
	"raw_ocr_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "scrim_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"type" "request_type" DEFAULT 'SEARCH' NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 120 NOT NULL,
	"min_elo" integer DEFAULT 0 NOT NULL,
	"max_elo" integer DEFAULT 5000 NOT NULL,
	"preferred_maps" jsonb,
	"server_region" varchar(50),
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"opponent_organization_id" uuid,
	"from_request_id" uuid,
	"opponent_name" varchar,
	"title" varchar(255),
	"scheduled_start" timestamp with time zone NOT NULL,
	"format" "scrim_format" DEFAULT 'BO1' NOT NULL,
	"status" "scrim_status" DEFAULT 'DRAFT' NOT NULL,
	"cancellation_reason" text,
	"server_connection_string" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_availabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'player' NOT NULL,
	"ingame_role" varchar(50),
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"acronym" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"pending_email" varchar(255),
	"username" varchar(30) NOT NULL,
	"password_hash" varchar(255),
	"avatar_url" text,
	"country" varchar(2),
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"global_role" "global_role" DEFAULT 'user' NOT NULL,
	"settings" jsonb DEFAULT '{"email_match_found":true,"email_scrim_reminder":true,"push_new_message":true}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"type" "verification_type" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_scrim_game_id_scrim_games_id_fk" FOREIGN KEY ("scrim_game_id") REFERENCES "public"."scrim_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_games" ADD CONSTRAINT "scrim_games_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_games" ADD CONSTRAINT "scrim_games_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_messages" ADD CONSTRAINT "scrim_messages_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_messages" ADD CONSTRAINT "scrim_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_requests" ADD CONSTRAINT "scrim_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_requests" ADD CONSTRAINT "scrim_requests_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrims" ADD CONSTRAINT "scrims_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrims" ADD CONSTRAINT "scrims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrims" ADD CONSTRAINT "scrims_opponent_organization_id_organizations_id_fk" FOREIGN KEY ("opponent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_availabilities" ADD CONSTRAINT "team_availabilities_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_acc_unique" ON "connected_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "connected_acc_user_idx" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_map_slug_per_game" ON "maps" USING btree ("game_id","slug");--> statement-breakpoint
CREATE INDEX "unread_notifs_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_org_member" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "orgs_active_slug_idx" ON "organizations" USING btree ("slug") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_stat_per_game" ON "player_game_stats" USING btree ("scrim_game_id","user_id");--> statement-breakpoint
CREATE INDEX "stats_data_gin_idx" ON "player_game_stats" USING gin ("data");--> statement-breakpoint
CREATE INDEX "scrim_game_idx" ON "scrim_games" USING btree ("scrim_id");--> statement-breakpoint
CREATE INDEX "scrim_req_main_idx" ON "scrim_requests" USING btree ("game_id","status","date");--> statement-breakpoint
CREATE INDEX "scrim_req_elo_idx" ON "scrim_requests" USING btree ("min_elo","max_elo");--> statement-breakpoint
CREATE INDEX "scrim_calendar_idx" ON "scrims" USING btree ("scheduled_start","status");--> statement-breakpoint
CREATE INDEX "scrim_host_org_idx" ON "scrims" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "availability_idx" ON "team_availabilities" USING btree ("team_id","day_of_week");--> statement-breakpoint
CREATE INDEX "active_roster_idx" ON "team_members" USING btree ("team_id","end_date");--> statement-breakpoint
CREATE INDEX "teams_active_idx" ON "teams" USING btree ("organization_id") WHERE "teams"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_token_idx" ON "verifications" USING btree ("token");--> statement-breakpoint
CREATE INDEX "verification_user_idx" ON "verifications" USING btree ("user_id");