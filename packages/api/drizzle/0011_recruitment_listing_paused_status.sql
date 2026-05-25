-- disable transaction
ALTER TYPE "public"."recruitment_listing_status" ADD VALUE 'paused' BEFORE 'closed';