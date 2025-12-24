CREATE TYPE "public"."availability_status" AS ENUM('AVAILABLE', 'UNAVAILABLE', 'TENTATIVE');--> statement-breakpoint
CREATE TYPE "public"."day_of_week" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');--> statement-breakpoint
CREATE TYPE "public"."elo_reason" AS ENUM('match', 'penalty', 'decay', 'rollback', 'calibration');--> statement-breakpoint
CREATE TYPE "public"."flag_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."global_role" AS ENUM('admin', 'staff', 'user');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ocr_status" AS ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."provider_type" AS ENUM('steam', 'discord', 'riot', 'twitch', 'battle_net');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('ACTIVE', 'PAUSED', 'FULFILLED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('SEARCH', 'OFFER');--> statement-breakpoint
CREATE TYPE "public"."scrim_format" AS ENUM('BO1', 'BO2', 'BO3', 'BO5', 'BO7');--> statement-breakpoint
CREATE TYPE "public"."scrim_preference_type" AS ENUM('AVOID', 'PREFER');--> statement-breakpoint
CREATE TYPE "public"."scrim_status" AS ENUM('DRAFT', 'PENDING', 'CONFIRMED', 'LIVE', 'PROCESSING', 'COMPLETED', 'DISPUTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'captain', 'player', 'coach', 'analyst', 'manager');--> statement-breakpoint
CREATE TYPE "public"."team_roster_status" AS ENUM('STARTER', 'SUBSTITUTE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
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
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"game_id" uuid NOT NULL,
	"scrim_id" uuid,
	"old_elo" integer NOT NULL,
	"new_elo" integer NOT NULL,
	"change" integer NOT NULL,
	"reason" "elo_reason" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_stat_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"schema" jsonb NOT NULL,
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
	"stat_schema_version" integer DEFAULT 1 NOT NULL,
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
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "player_availabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"status" "availability_status" DEFAULT 'AVAILABLE' NOT NULL,
	"note" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "availability_status" DEFAULT 'UNAVAILABLE' NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_game_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scrim_participant_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"is_substitute" boolean DEFAULT false NOT NULL,
	"role_played" varchar(50),
	"won" boolean NOT NULL,
	"stats" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"label" varchar(150) NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_by_user_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_game_screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_game_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"ocr_status" "ocr_status" DEFAULT 'PENDING' NOT NULL,
	"ocr_confidence" real,
	"extracted_data" jsonb,
	"raw_ocr_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scrim_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"map_id" uuid NOT NULL,
	"mode" varchar(50) NOT NULL,
	"order_index" integer NOT NULL,
	"status" "scrim_status" DEFAULT 'COMPLETED' NOT NULL,
	"winner_participant_id" uuid,
	"screenshot_url" text,
	"raw_ocr_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "scrim_lineups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_participant_id" uuid NOT NULL,
	"team_member_id" uuid,
	"user_id" uuid NOT NULL,
	"is_substitute" boolean DEFAULT false NOT NULL,
	"role_played" varchar(50),
	"last_read_message_id" uuid,
	"confirmed_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "scrim_moderation_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"raised_by_user_id" uuid NOT NULL,
	"reason" varchar(255) NOT NULL,
	"severity" "flag_severity" DEFAULT 'MEDIUM' NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_note" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"final_score" integer DEFAULT 0 NOT NULL,
	"ready_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"forfeited" boolean DEFAULT false NOT NULL,
	"notes" varchar(255),
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
	"status" "request_status" DEFAULT 'ACTIVE' NOT NULL,
	"note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_result_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"notes" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid
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
	"winner_participant_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"location" jsonb,
	"device" varchar(255),
	"user_agent" text,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "team_blackouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'player' NOT NULL,
	"message" varchar(255),
	"token" varchar(128) NOT NULL,
	"status" "invite_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'player' NOT NULL,
	"roster_status" "team_roster_status" DEFAULT 'SUBSTITUTE' NOT NULL,
	"ingame_role" varchar(50),
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_role_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"role" "team_role" NOT NULL,
	"max_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_roster_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"enforced_by_user_id" uuid,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_scrim_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"target_organization_id" uuid,
	"target_team_id" uuid,
	"preference" "scrim_preference_type" NOT NULL,
	"note" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"acronym" varchar(10) NOT NULL,
	"cached_composite_elo" integer DEFAULT 0 NOT NULL,
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
	"locale" varchar(5) DEFAULT 'en-US' NOT NULL,
	"elo" integer DEFAULT 1200 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"global_role" "global_role" DEFAULT 'user' NOT NULL,
	"settings" jsonb DEFAULT '{"email_match_found":true,"email_scrim_reminder":true,"push_new_message":true}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
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
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_stat_templates" ADD CONSTRAINT "game_stat_templates_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_availabilities" ADD CONSTRAINT "player_availabilities_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_availabilities" ADD CONSTRAINT "player_availabilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_availability_exceptions" ADD CONSTRAINT "player_availability_exceptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_availability_exceptions" ADD CONSTRAINT "player_availability_exceptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_scrim_game_id_scrim_games_id_fk" FOREIGN KEY ("scrim_game_id") REFERENCES "public"."scrim_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_scrim_participant_id_scrim_participants_id_fk" FOREIGN KEY ("scrim_participant_id") REFERENCES "public"."scrim_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_checklists" ADD CONSTRAINT "scrim_checklists_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_checklists" ADD CONSTRAINT "scrim_checklists_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_game_screenshots" ADD CONSTRAINT "scrim_game_screenshots_scrim_game_id_scrim_games_id_fk" FOREIGN KEY ("scrim_game_id") REFERENCES "public"."scrim_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_game_screenshots" ADD CONSTRAINT "scrim_game_screenshots_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_games" ADD CONSTRAINT "scrim_games_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_games" ADD CONSTRAINT "scrim_games_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_games" ADD CONSTRAINT "scrim_games_winner_participant_id_scrim_participants_id_fk" FOREIGN KEY ("winner_participant_id") REFERENCES "public"."scrim_participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_lineups" ADD CONSTRAINT "scrim_lineups_scrim_participant_id_scrim_participants_id_fk" FOREIGN KEY ("scrim_participant_id") REFERENCES "public"."scrim_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_lineups" ADD CONSTRAINT "scrim_lineups_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_lineups" ADD CONSTRAINT "scrim_lineups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_lineups" ADD CONSTRAINT "scrim_lineups_last_read_message_id_scrim_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."scrim_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_messages" ADD CONSTRAINT "scrim_messages_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_messages" ADD CONSTRAINT "scrim_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_moderation_flags" ADD CONSTRAINT "scrim_moderation_flags_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_moderation_flags" ADD CONSTRAINT "scrim_moderation_flags_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_participants" ADD CONSTRAINT "scrim_participants_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_participants" ADD CONSTRAINT "scrim_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_requests" ADD CONSTRAINT "scrim_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_requests" ADD CONSTRAINT "scrim_requests_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_result_verifications" ADD CONSTRAINT "scrim_result_verifications_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_result_verifications" ADD CONSTRAINT "scrim_result_verifications_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_result_verifications" ADD CONSTRAINT "scrim_result_verifications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrims" ADD CONSTRAINT "scrims_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrims" ADD CONSTRAINT "scrims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrims" ADD CONSTRAINT "scrims_opponent_organization_id_organizations_id_fk" FOREIGN KEY ("opponent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_availabilities" ADD CONSTRAINT "team_availabilities_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_blackouts" ADD CONSTRAINT "team_blackouts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_role_limits" ADD CONSTRAINT "team_role_limits_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_roster_locks" ADD CONSTRAINT "team_roster_locks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_roster_locks" ADD CONSTRAINT "team_roster_locks_enforced_by_user_id_users_id_fk" FOREIGN KEY ("enforced_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_scrim_preferences" ADD CONSTRAINT "team_scrim_preferences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_scrim_preferences" ADD CONSTRAINT "team_scrim_preferences_target_organization_id_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_scrim_preferences" ADD CONSTRAINT "team_scrim_preferences_target_team_id_teams_id_fk" FOREIGN KEY ("target_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_acc_unique" ON "connected_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "connected_acc_user_idx" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_stat_template_version" ON "game_stat_templates" USING btree ("game_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_map_slug_per_game" ON "maps" USING btree ("game_id","slug");--> statement-breakpoint
CREATE INDEX "unread_notifs_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_org_member" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "orgs_active_slug_idx" ON "organizations" USING btree ("slug") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "player_availability_unique" ON "player_availabilities" USING btree ("team_id","user_id","day_of_week","start_time","end_time");--> statement-breakpoint
CREATE INDEX "player_availability_lookup_idx" ON "player_availabilities" USING btree ("team_id","day_of_week");--> statement-breakpoint
CREATE INDEX "player_availability_exception_idx" ON "player_availability_exceptions" USING btree ("team_id","user_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_stat_per_game" ON "player_game_stats" USING btree ("scrim_game_id","user_id");--> statement-breakpoint
CREATE INDEX "stats_user_history_idx" ON "player_game_stats" USING btree ("user_id","scrim_game_id");--> statement-breakpoint
CREATE INDEX "stats_data_gin_idx" ON "player_game_stats" USING btree ("stats");--> statement-breakpoint
CREATE INDEX "scrim_checklist_idx" ON "scrim_checklists" USING btree ("scrim_id","required");--> statement-breakpoint
CREATE INDEX "scrim_game_screenshot_idx" ON "scrim_game_screenshots" USING btree ("scrim_game_id","ocr_status");--> statement-breakpoint
CREATE INDEX "scrim_game_idx" ON "scrim_games" USING btree ("scrim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scrim_lineup_unique" ON "scrim_lineups" USING btree ("scrim_participant_id","user_id");--> statement-breakpoint
CREATE INDEX "scrim_lineup_participant_idx" ON "scrim_lineups" USING btree ("scrim_participant_id");--> statement-breakpoint
CREATE INDEX "scrim_flag_idx" ON "scrim_moderation_flags" USING btree ("scrim_id","resolved");--> statement-breakpoint
CREATE UNIQUE INDEX "scrim_participant_unique" ON "scrim_participants" USING btree ("scrim_id","team_id");--> statement-breakpoint
CREATE INDEX "scrim_participant_scrim_idx" ON "scrim_participants" USING btree ("scrim_id");--> statement-breakpoint
CREATE INDEX "scrim_req_search_idx" ON "scrim_requests" USING btree ("status","game_id","min_elo","max_elo","date");--> statement-breakpoint
CREATE INDEX "scrim_result_verify_idx" ON "scrim_result_verifications" USING btree ("scrim_id","status");--> statement-breakpoint
CREATE INDEX "scrim_calendar_idx" ON "scrims" USING btree ("scheduled_start","status");--> statement-breakpoint
CREATE INDEX "scrim_host_org_idx" ON "scrims" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "availability_idx" ON "team_availabilities" USING btree ("team_id","day_of_week");--> statement-breakpoint
CREATE INDEX "team_blackout_range_idx" ON "team_blackouts" USING btree ("team_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_token_unique" ON "team_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_invite_lookup_idx" ON "team_invites" USING btree ("team_id","invited_user_id","status");--> statement-breakpoint
CREATE INDEX "active_roster_idx" ON "team_members" USING btree ("team_id","roster_status") WHERE "team_members"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "member_history_idx" ON "team_members" USING btree ("user_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_role_limit_unique" ON "team_role_limits" USING btree ("team_id","role");--> statement-breakpoint
CREATE INDEX "team_roster_lock_idx" ON "team_roster_locks" USING btree ("team_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "team_scrim_pref_unique" ON "team_scrim_preferences" USING btree ("team_id","target_organization_id","target_team_id","preference");--> statement-breakpoint
CREATE INDEX "teams_active_idx" ON "teams" USING btree ("organization_id") WHERE "teams"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "teams_elo_idx" ON "teams" USING btree ("game_id","cached_composite_elo");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_active" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique_active" ON "users" USING btree ("username") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_elo_idx" ON "users" USING btree ("elo");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_token_idx" ON "verifications" USING btree ("token");--> statement-breakpoint
CREATE INDEX "verification_user_idx" ON "verifications" USING btree ("user_id");