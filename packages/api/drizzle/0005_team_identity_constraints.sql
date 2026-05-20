DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "team"
		WHERE "is_archived" = false
		GROUP BY "organization_id", lower("name")
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot create team_org_active_name_unique_idx: duplicate active team names exist within an organization';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "team"
		WHERE "is_archived" = false
		GROUP BY "organization_id", upper("tag")
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot create team_org_active_tag_unique_idx: duplicate active team tags exist within an organization';
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "team_org_active_name_unique_idx" ON "team" USING btree ("organization_id",lower("name")) WHERE "team"."is_archived" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "team_org_active_tag_unique_idx" ON "team" USING btree ("organization_id",upper("tag")) WHERE "team"."is_archived" = false;
