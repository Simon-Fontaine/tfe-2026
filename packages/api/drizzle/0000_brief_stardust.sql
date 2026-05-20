CREATE TYPE "public"."audit_action" AS ENUM('login_success', 'login_failed', 'logout', 'logout_all_devices', 'signup', 'password_change', 'password_reset_request', 'password_reset_complete', 'email_change_request', 'email_change_complete', 'two_factor_enable', 'two_factor_disable', 'passkey_register', 'passkey_remove', 'security_key_register', 'security_key_remove', 'recovery_codes_regenerate', 'data_export_request', 'account_deletion_request', 'account_deletion_confirm', 'account_deletion_cancel', 'session_revoked', 'new_device_detected', 'new_location_detected');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('scrim_lobby', 'scrim_negotiation', 'team', 'recruitment', 'direct');--> statement-breakpoint
CREATE TYPE "public"."confirmation_status" AS ENUM('pending', 'confirmed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."dispute_resolution" AS ENUM('pending', 'home_confirmed', 'away_confirmed', 'admin_resolved', 'voided');--> statement-breakpoint
CREATE TYPE "public"."game_mode" AS ENUM('competitive_role_queue', 'competitive_open_queue', 'custom_game', 'conquest_meta_event', 'deathmatch', 'payload_race', 'stadium_competitive', 'unranked_role_queue', 'unranked_open_queue');--> statement-breakpoint
CREATE TYPE "public"."map_type" AS ENUM('assault', 'clash', 'control', 'escort', 'flashpoint', 'hybrid', 'push', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('victory', 'defeat', 'draw');--> statement-breakpoint
CREATE TYPE "public"."member_type" AS ENUM('player', 'staff');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('scrim_request', 'scrim_accepted', 'scrim_cancelled', 'scrim_disputed', 'scrim_resolved', 'scrim_reminder', 'recruitment_application', 'recruitment_accepted', 'recruitment_rejected', 'recruitment_withdrawn', 'ocr_completed', 'ocr_failed', 'dispute_opened', 'dispute_resolved', 'sr_updated', 'new_message', 'channel_invite', 'email_change_requested', 'account_deletion_requested', 'new_device_login', 'new_location_login', 'session_revoked_alert', 'generic', 'team_invite_received', 'team_invite_accepted', 'org_invite_received');--> statement-breakpoint
CREATE TYPE "public"."ocr_job_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'requires_review');--> statement-breakpoint
CREATE TYPE "public"."org_invite_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."ow2_rank" AS ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion');--> statement-breakpoint
CREATE TYPE "public"."ow2_role" AS ENUM('tank', 'damage', 'support');--> statement-breakpoint
CREATE TYPE "public"."player_stat_side" AS ENUM('home', 'away', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."recruitment_application_status" AS ENUM('pending', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."recruitment_listing_category" AS ENUM('lft', 'lfp', 'lfr', 'lfs');--> statement-breakpoint
CREATE TYPE "public"."recruitment_listing_status" AS ENUM('open', 'closed', 'fulfilled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."recruitment_owner_type" AS ENUM('player', 'team', 'organization');--> statement-breakpoint
CREATE TYPE "public"."roster_status" AS ENUM('active', 'benched', 'trial', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."scrim_status" AS ENUM('pending', 'accepted', 'scheduled', 'in_progress', 'awaiting_confirmation', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."session_revocation_reason" AS ENUM('manual_logout', 'logout_all_devices', 'password_change', 'email_change', 'two_factor_change', 'admin_revoke', 'security_alert', 'account_deletion');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('coach', 'analyst', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."team_invite_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."update_scope" AS ENUM('team', 'organization');--> statement-breakpoint
CREATE TYPE "public"."update_visibility" AS ENUM('workspace', 'public');--> statement-breakpoint
CREATE TYPE "public"."verification_action" AS ENUM('email_change', 'account_deletion', 'password_change', 'two_factor_disable', 'passkey_disable', 'security_key_disable', 'recovery_code_regenerate');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"geo_country" text,
	"geo_city" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_deletion_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"reason" text,
	"ip_address" text,
	"expires_at" timestamp NOT NULL,
	"confirmed_at" timestamp,
	"scheduled_deletion_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_change_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_email" text NOT NULL,
	"new_email" text NOT NULL,
	"code" text NOT NULL,
	"ip_address" text,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"algorithm" integer NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"two_factor_verified" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_key_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"algorithm" integer NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensitive_action_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" "verification_action" NOT NULL,
	"code" text NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"two_factor_verified" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_id" uuid,
	"geo_country" text,
	"geo_city" text,
	"geo_lat" text,
	"geo_lon" text,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revocation_reason" "session_revocation_reason",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "totp_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"last_used_counter" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "totp_credential_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"device_name" text NOT NULL,
	"browser_name" text,
	"os_name" text,
	"device_type" text,
	"first_ip_address" text,
	"first_geo_country" text,
	"first_geo_city" text,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"recovery_code" text,
	"avatar_url" text,
	"banner_url" text,
	"bio" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb,
	"is_banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"day_of_week" smallint,
	"specific_date" timestamp,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_channel_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"last_read_at" timestamp,
	"left_at" timestamp,
	"is_muted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_type" "channel_type" NOT NULL,
	"name" text NOT NULL,
	"scrim_id" uuid,
	"team_id" uuid,
	"recruitment_application_id" uuid,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message_read" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_read_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"sender_id" uuid,
	"content" text NOT NULL,
	"reply_to_message_id" uuid,
	"attachment_url" text,
	"is_system_message" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hero" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" "ow2_role" NOT NULL,
	"image_url" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"map_type" "map_type" NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"reference_type" text,
	"reference_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"submitted_by_user_id" uuid,
	"screenshot_type" text NOT NULL,
	"image_url" text NOT NULL,
	"status" "ocr_job_status" DEFAULT 'queued' NOT NULL,
	"progress_stage" text DEFAULT 'queued' NOT NULL,
	"run_after" timestamp DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp,
	"provider_name" text,
	"provider_model" text,
	"prompt_version" text,
	"raw_ocr_output" jsonb,
	"validated_output" jsonb,
	"confidence_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"processing_time_ms" integer,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_draft" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_step" text DEFAULT 'battletag' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invitee_user_id" uuid NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"member_type" "member_type" DEFAULT 'player' NOT NULL,
	"staff_role" "staff_role",
	"game_role" "ow2_role",
	"status" "org_invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"member_type" "member_type" DEFAULT 'player' NOT NULL,
	"staff_role" "staff_role",
	"game_role" "ow2_role",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"avatar_url" text,
	"banner_url" text,
	"website" text,
	"discord" text,
	"twitter" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "player_hero" (
	"user_id" uuid NOT NULL,
	"hero_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_hero_user_id_hero_id_pk" PRIMARY KEY("user_id","hero_id")
);
--> statement-breakpoint
CREATE TABLE "player_map" (
	"user_id" uuid NOT NULL,
	"map_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_map_user_id_map_id_pk" PRIMARY KEY("user_id","map_id")
);
--> statement-breakpoint
CREATE TABLE "player_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"battletag" text,
	"primary_role" "ow2_role" NOT NULL,
	"secondary_role" "ow2_role",
	"rank" "ow2_rank",
	"rank_division" smallint,
	"profile_visibility" text DEFAULT 'public' NOT NULL,
	"availability_visibility" text DEFAULT 'public' NOT NULL,
	"recruiting_discoverability" boolean DEFAULT true NOT NULL,
	"public_history_visibility" text DEFAULT 'public' NOT NULL,
	"participation_intent" text DEFAULT 'find_team' NOT NULL,
	"availability_intent" text DEFAULT 'not_sure' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "recruitment_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"applicant_user_id" uuid NOT NULL,
	"applicant_team_id" uuid,
	"applicant_organization_id" uuid,
	"message" text,
	"status" "recruitment_application_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruitment_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "recruitment_listing_category" NOT NULL,
	"status" "recruitment_listing_status" DEFAULT 'open' NOT NULL,
	"owner_type" "recruitment_owner_type" DEFAULT 'player' NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"team_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"member_type" "member_type" DEFAULT 'player' NOT NULL,
	"staff_role" "staff_role",
	"roles_needed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_rank" "ow2_rank",
	"max_rank" "ow2_rank",
	"min_rating" integer,
	"max_rating" integer,
	"hero_pool_filter" jsonb DEFAULT '[]'::jsonb,
	"description" text,
	"region" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_confirmation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"status" "confirmation_status" DEFAULT 'pending' NOT NULL,
	"dispute_reason" text,
	"confirmed_by_user_id" uuid,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"map_order" smallint NOT NULL,
	"map_name" text NOT NULL,
	"map_type" "map_type" NOT NULL,
	"game_mode" "game_mode" DEFAULT 'custom_game' NOT NULL,
	"duration_seconds" integer,
	"result" "match_result" NOT NULL,
	"home_score" smallint DEFAULT 0 NOT NULL,
	"away_score" smallint DEFAULT 0 NOT NULL,
	"ocr_job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_player_stat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_map_id" uuid NOT NULL,
	"side" "player_stat_side" NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"player_name" text NOT NULL,
	"hero" text,
	"role" "ow2_role",
	"eliminations" integer,
	"assists" integer,
	"deaths" integer,
	"damage" integer,
	"healing" integer,
	"mitigation" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim_result_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"revision_number" smallint NOT NULL,
	"reporting_team_id" uuid,
	"submitted_by_user_id" uuid,
	"source_ocr_job_id" uuid,
	"home_map_score" smallint DEFAULT 0 NOT NULL,
	"away_map_score" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"snapshot" jsonb NOT NULL,
	"change_summary" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid,
	"status" "scrim_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"home_map_score" smallint DEFAULT 0 NOT NULL,
	"away_map_score" smallint DEFAULT 0 NOT NULL,
	"dispute_resolution" "dispute_resolution",
	"dispute_resolved_by_user_id" uuid,
	"dispute_resolved_at" timestamp,
	"dispute_notes" text,
	"created_by_user_id" uuid,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"invitee_user_id" uuid NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"member_type" "member_type" DEFAULT 'player' NOT NULL,
	"role_in_team" "ow2_role",
	"staff_role" "staff_role",
	"permission_role" "team_member_role" DEFAULT 'member' NOT NULL,
	"status" "team_invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_rating_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"scrim_id" uuid NOT NULL,
	"rating_before" integer NOT NULL,
	"rating_after" integer NOT NULL,
	"rating_delta" integer NOT NULL,
	"rating_deviation_before" integer,
	"rating_deviation_after" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_roster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"member_type" "member_type" DEFAULT 'player' NOT NULL,
	"role_in_team" "ow2_role",
	"staff_role" "staff_role",
	"permission_role" "team_member_role" DEFAULT 'member' NOT NULL,
	"status" "roster_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tag" text NOT NULL,
	"description" text,
	"avatar_url" text,
	"banner_url" text,
	"rating" integer DEFAULT 1500 NOT NULL,
	"rating_deviation" integer DEFAULT 350 NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_recruiting" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "update_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" "update_scope" NOT NULL,
	"visibility" "update_visibility" DEFAULT 'workspace' NOT NULL,
	"author_user_id" uuid,
	"organization_id" uuid,
	"team_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_request" ADD CONSTRAINT "account_deletion_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_change_verification" ADD CONSTRAINT "email_change_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_request" ADD CONSTRAINT "email_verification_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey_credential" ADD CONSTRAINT "passkey_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_session" ADD CONSTRAINT "password_reset_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_key_credential" ADD CONSTRAINT "security_key_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_action_verification" ADD CONSTRAINT "sensitive_action_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_device_id_user_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."user_device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_credential" ADD CONSTRAINT "totp_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_device" ADD CONSTRAINT "user_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channel_member" ADD CONSTRAINT "chat_channel_member_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channel_member" ADD CONSTRAINT "chat_channel_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channel" ADD CONSTRAINT "chat_channel_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channel" ADD CONSTRAINT "chat_channel_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channel" ADD CONSTRAINT "chat_channel_recruitment_application_id_recruitment_application_id_fk" FOREIGN KEY ("recruitment_application_id") REFERENCES "public"."recruitment_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_read" ADD CONSTRAINT "chat_message_read_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_read" ADD CONSTRAINT "chat_message_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_job" ADD CONSTRAINT "ocr_job_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_job" ADD CONSTRAINT "ocr_job_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_draft" ADD CONSTRAINT "onboarding_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invite" ADD CONSTRAINT "org_invite_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invite" ADD CONSTRAINT "org_invite_invitee_user_id_user_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invite" ADD CONSTRAINT "org_invite_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_hero" ADD CONSTRAINT "player_hero_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_hero" ADD CONSTRAINT "player_hero_hero_id_hero_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."hero"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_map" ADD CONSTRAINT "player_map_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_map" ADD CONSTRAINT "player_map_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profile" ADD CONSTRAINT "player_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_application" ADD CONSTRAINT "recruitment_application_listing_id_recruitment_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."recruitment_listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_application" ADD CONSTRAINT "recruitment_application_applicant_user_id_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_application" ADD CONSTRAINT "recruitment_application_applicant_team_id_team_id_fk" FOREIGN KEY ("applicant_team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_application" ADD CONSTRAINT "recruitment_application_applicant_organization_id_organization_id_fk" FOREIGN KEY ("applicant_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_listing" ADD CONSTRAINT "recruitment_listing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_listing" ADD CONSTRAINT "recruitment_listing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_listing" ADD CONSTRAINT "recruitment_listing_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_confirmation" ADD CONSTRAINT "scrim_confirmation_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_confirmation" ADD CONSTRAINT "scrim_confirmation_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_confirmation" ADD CONSTRAINT "scrim_confirmation_confirmed_by_user_id_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_map" ADD CONSTRAINT "scrim_map_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_map" ADD CONSTRAINT "scrim_map_ocr_job_id_ocr_job_id_fk" FOREIGN KEY ("ocr_job_id") REFERENCES "public"."ocr_job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_player_stat" ADD CONSTRAINT "scrim_player_stat_scrim_map_id_scrim_map_id_fk" FOREIGN KEY ("scrim_map_id") REFERENCES "public"."scrim_map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_player_stat" ADD CONSTRAINT "scrim_player_stat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_player_stat" ADD CONSTRAINT "scrim_player_stat_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_result_revision" ADD CONSTRAINT "scrim_result_revision_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_result_revision" ADD CONSTRAINT "scrim_result_revision_reporting_team_id_team_id_fk" FOREIGN KEY ("reporting_team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_result_revision" ADD CONSTRAINT "scrim_result_revision_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_result_revision" ADD CONSTRAINT "scrim_result_revision_source_ocr_job_id_ocr_job_id_fk" FOREIGN KEY ("source_ocr_job_id") REFERENCES "public"."ocr_job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim" ADD CONSTRAINT "scrim_home_team_id_team_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."team"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim" ADD CONSTRAINT "scrim_away_team_id_team_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."team"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim" ADD CONSTRAINT "scrim_dispute_resolved_by_user_id_user_id_fk" FOREIGN KEY ("dispute_resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim" ADD CONSTRAINT "scrim_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_invitee_user_id_user_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rating_event" ADD CONSTRAINT "team_rating_event_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rating_event" ADD CONSTRAINT "team_rating_event_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_roster" ADD CONSTRAINT "team_roster_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_roster" ADD CONSTRAINT "team_roster_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_post" ADD CONSTRAINT "update_post_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_post" ADD CONSTRAINT "update_post_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_post" ADD CONSTRAINT "update_post_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_ip_idx" ON "audit_log" USING btree ("ip_address","created_at");--> statement-breakpoint
CREATE INDEX "account_deletion_user_idx" ON "account_deletion_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_deletion_code_idx" ON "account_deletion_request" USING btree ("code");--> statement-breakpoint
CREATE INDEX "account_deletion_schedule_idx" ON "account_deletion_request" USING btree ("scheduled_deletion_at","cancelled_at");--> statement-breakpoint
CREATE INDEX "email_change_user_idx" ON "email_change_verification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_change_code_idx" ON "email_change_verification" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "email_change_active_idx" ON "email_change_verification" USING btree ("user_id","new_email");--> statement-breakpoint
CREATE INDEX "email_verification_user_idx" ON "email_verification_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_code_idx" ON "email_verification_request" USING btree ("code");--> statement-breakpoint
CREATE INDEX "passkey_user_idx" ON "passkey_credential" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_key_user_idx" ON "security_key_credential" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sensitive_action_user_idx" ON "sensitive_action_verification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sensitive_action_code_idx" ON "sensitive_action_verification" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "sensitive_action_active_idx" ON "sensitive_action_verification" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "session_user_active_idx" ON "session" USING btree ("user_id","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "session_user_history_idx" ON "session" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "session_device_idx" ON "session" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "session_expiry_idx" ON "session" USING btree ("expires_at","revoked_at");--> statement-breakpoint
CREATE INDEX "totp_user_idx" ON "totp_credential" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_device_fingerprint_idx" ON "user_device" USING btree ("user_id","fingerprint");--> statement-breakpoint
CREATE INDEX "user_device_user_idx" ON "user_device" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_idx" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "availability_user_idx" ON "availability" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "availability_team_idx" ON "availability" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "availability_user_team_idx" ON "availability" USING btree ("user_id","team_id");--> statement-breakpoint
CREATE INDEX "availability_schedule_idx" ON "availability" USING btree ("user_id","team_id","day_of_week");--> statement-breakpoint
CREATE INDEX "availability_specific_idx" ON "availability" USING btree ("user_id","team_id","specific_date");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_member_unique_idx" ON "chat_channel_member" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "chat_member_user_idx" ON "chat_channel_member" USING btree ("user_id","left_at");--> statement-breakpoint
CREATE INDEX "chat_member_channel_idx" ON "chat_channel_member" USING btree ("channel_id","left_at");--> statement-breakpoint
CREATE INDEX "chat_channel_scrim_idx" ON "chat_channel" USING btree ("scrim_id");--> statement-breakpoint
CREATE INDEX "chat_channel_team_idx" ON "chat_channel" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "chat_channel_recruitment_app_idx" ON "chat_channel" USING btree ("recruitment_application_id");--> statement-breakpoint
CREATE INDEX "chat_channel_type_idx" ON "chat_channel" USING btree ("channel_type","is_archived");--> statement-breakpoint
CREATE INDEX "chat_message_read_user_idx" ON "chat_message_read" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_read_msg_idx" ON "chat_message_read" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_message_channel_idx" ON "chat_message" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_message_sender_idx" ON "chat_message" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "chat_message_reply_idx" ON "chat_message" USING btree ("reply_to_message_id");--> statement-breakpoint
CREATE INDEX "hero_role_idx" ON "hero" USING btree ("role");--> statement-breakpoint
CREATE INDEX "hero_active_idx" ON "hero" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "map_type_idx" ON "map" USING btree ("map_type");--> statement-breakpoint
CREATE INDEX "map_active_idx" ON "map" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "notification_inbox_idx" ON "notification" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ocr_job_scrim_idx" ON "ocr_job" USING btree ("scrim_id");--> statement-breakpoint
CREATE INDEX "ocr_job_status_idx" ON "ocr_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ocr_job_queue_idx" ON "ocr_job" USING btree ("status","run_after","lease_expires_at");--> statement-breakpoint
CREATE INDEX "ocr_job_user_idx" ON "ocr_job" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "onboarding_draft_updated_idx" ON "onboarding_draft" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "org_invite_org_idx" ON "org_invite" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_invite_invitee_idx" ON "org_invite" USING btree ("invitee_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_member_unique_idx" ON "organization_member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "org_member_user_idx" ON "organization_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "player_hero_user_idx" ON "player_hero" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_hero_hero_idx" ON "player_hero" USING btree ("hero_id");--> statement-breakpoint
CREATE INDEX "player_map_user_idx" ON "player_map" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_map_map_idx" ON "player_map" USING btree ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profile_user_idx" ON "player_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_profile_battletag_idx" ON "player_profile" USING btree ("battletag");--> statement-breakpoint
CREATE INDEX "player_profile_role_rank_idx" ON "player_profile" USING btree ("primary_role","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_application_unique_idx" ON "recruitment_application" USING btree ("listing_id","applicant_user_id") WHERE "recruitment_application"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "recruitment_application_listing_idx" ON "recruitment_application" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "recruitment_application_user_idx" ON "recruitment_application" USING btree ("applicant_user_id");--> statement-breakpoint
CREATE INDEX "recruitment_listing_feed_idx" ON "recruitment_listing" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "recruitment_listing_role_rank_idx" ON "recruitment_listing" USING btree ("status","min_rank","max_rank");--> statement-breakpoint
CREATE INDEX "recruitment_listing_rating_range_idx" ON "recruitment_listing" USING btree ("status","min_rating","max_rating");--> statement-breakpoint
CREATE INDEX "recruitment_listing_hero_pool_gin_idx" ON "recruitment_listing" USING gin ("hero_pool_filter" jsonb_ops);--> statement-breakpoint
CREATE INDEX "recruitment_listing_user_idx" ON "recruitment_listing" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recruitment_listing_team_idx" ON "recruitment_listing" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scrim_confirm_unique_idx" ON "scrim_confirmation" USING btree ("scrim_id","team_id");--> statement-breakpoint
CREATE INDEX "scrim_confirm_scrim_idx" ON "scrim_confirmation" USING btree ("scrim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scrim_map_order_idx" ON "scrim_map" USING btree ("scrim_id","map_order");--> statement-breakpoint
CREATE INDEX "scrim_map_scrim_idx" ON "scrim_map" USING btree ("scrim_id");--> statement-breakpoint
CREATE INDEX "scrim_map_name_idx" ON "scrim_map" USING btree ("map_name","result");--> statement-breakpoint
CREATE INDEX "scrim_map_type_idx" ON "scrim_map" USING btree ("map_type");--> statement-breakpoint
CREATE INDEX "player_stat_map_idx" ON "scrim_player_stat" USING btree ("scrim_map_id");--> statement-breakpoint
CREATE INDEX "player_stat_user_idx" ON "scrim_player_stat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_stat_hero_idx" ON "scrim_player_stat" USING btree ("user_id","hero");--> statement-breakpoint
CREATE INDEX "player_stat_team_idx" ON "scrim_player_stat" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_stat_unique_idx" ON "scrim_player_stat" USING btree ("scrim_map_id","player_name","side");--> statement-breakpoint
CREATE UNIQUE INDEX "scrim_result_revision_unique_idx" ON "scrim_result_revision" USING btree ("scrim_id","revision_number");--> statement-breakpoint
CREATE INDEX "scrim_result_revision_scrim_idx" ON "scrim_result_revision" USING btree ("scrim_id","created_at");--> statement-breakpoint
CREATE INDEX "scrim_result_revision_reporting_team_idx" ON "scrim_result_revision" USING btree ("reporting_team_id");--> statement-breakpoint
CREATE INDEX "scrim_result_revision_source_ocr_idx" ON "scrim_result_revision" USING btree ("source_ocr_job_id");--> statement-breakpoint
CREATE INDEX "scrim_home_team_idx" ON "scrim" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "scrim_away_team_idx" ON "scrim" USING btree ("away_team_id");--> statement-breakpoint
CREATE INDEX "scrim_status_idx" ON "scrim" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scrim_schedule_idx" ON "scrim" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "scrim_team_history_idx" ON "scrim" USING btree ("home_team_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "team_invite_team_idx" ON "team_invite" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invite_invitee_idx" ON "team_invite" USING btree ("invitee_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_rating_event_team_scrim_idx" ON "team_rating_event" USING btree ("team_id","scrim_id");--> statement-breakpoint
CREATE INDEX "team_rating_event_team_idx" ON "team_rating_event" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "team_rating_event_scrim_idx" ON "team_rating_event" USING btree ("scrim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_roster_unique_idx" ON "team_roster" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_roster_user_idx" ON "team_roster" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_roster_active_idx" ON "team_roster" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "team_org_idx" ON "team" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "team_matchmaking_idx" ON "team" USING btree ("rating","is_archived");--> statement-breakpoint
CREATE INDEX "update_post_scope_idx" ON "update_post" USING btree ("scope_type","created_at");--> statement-breakpoint
CREATE INDEX "update_post_team_idx" ON "update_post" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "update_post_org_idx" ON "update_post" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "update_post_visibility_idx" ON "update_post" USING btree ("visibility","created_at");--> statement-breakpoint
CREATE INDEX "update_post_author_idx" ON "update_post" USING btree ("author_user_id","created_at");
