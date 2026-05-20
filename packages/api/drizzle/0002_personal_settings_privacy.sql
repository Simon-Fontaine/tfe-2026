ALTER TABLE "player_profile" ADD COLUMN IF NOT EXISTS "availability_visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profile" ADD COLUMN IF NOT EXISTS "recruiting_discoverability" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profile" ADD COLUMN IF NOT EXISTS "public_history_visibility" text DEFAULT 'public' NOT NULL;
