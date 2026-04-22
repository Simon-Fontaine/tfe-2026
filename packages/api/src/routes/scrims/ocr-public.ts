import { CreateScrimOcrJobSchema } from "@scrimflow/shared";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import { ocrJobTable, scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { canAccessScrim, canManageAnyScrimTeam } from "./access";
import { PUBLIC_SCRIM_STATUSES } from "./constants";
import { mapOcrJob, mapScrimDetail, mapScrimSummary, publishOcrJobRealtimeUpdate } from "./detail";
import { findScrimWithRelations } from "./shared";

export function registerScrimOcrRoutes(scrimRoutes: Hono<AuthEnv>) {
	scrimRoutes.get("/:id/ocr-jobs", async (c) => {
		const user = c.get("user");
		const scrim = await findScrimWithRelations(c.req.param("id"));
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!(await canAccessScrim(user.id, scrim))) {
			return c.json({ error: "You do not have access to this scrim." }, 403);
		}

		return c.json({
			data: mapScrimDetail(scrim).ocrJobs,
		});
	});

	scrimRoutes.post("/:id/ocr-jobs", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(CreateScrimOcrJobSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!(await canAccessScrim(user.id, scrim))) {
			return c.json({ error: "You do not have access to this scrim." }, 403);
		}

		const [job] = await db
			.insert(ocrJobTable)
			.values({
				scrimId,
				submittedByUserId: user.id,
				screenshotType: parsed.output.screenshotType,
				imageUrl: parsed.output.imageUrl,
				status: "queued",
				progressStage: "queued",
				runAfter: new Date(),
				confidenceFlags: [],
			})
			.returning({ id: ocrJobTable.id });

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after OCR job creation." }, 500);

		const createdJob =
			mapScrimDetail(detail).ocrJobs.find((ocrJob) => ocrJob.id === job.id) ?? null;
		if (createdJob) {
			publishOcrJobRealtimeUpdate(createdJob);
		}

		return c.json({ data: createdJob }, 201);
	});

	scrimRoutes.post("/:id/ocr-jobs/:jobId/retry", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const jobId = c.req.param("jobId");

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!(await canManageAnyScrimTeam(user.id, scrim))) {
			return c.json({ error: "Only a team manager can retry OCR jobs for this scrim." }, 403);
		}

		const existingJob = scrim.ocrJobs.find((job) => job.id === jobId);
		if (!existingJob) {
			return c.json({ error: "OCR job not found." }, 404);
		}

		await db
			.update(ocrJobTable)
			.set({
				status: "queued",
				progressStage: "queued",
				errorCode: null,
				errorMessage: null,
				runAfter: new Date(),
				leaseExpiresAt: null,
				startedAt: null,
				completedAt: null,
				processingTimeMs: null,
				rawOcrOutput: null,
				validatedOutput: null,
				confidenceFlags: [],
			})
			.where(eq(ocrJobTable.id, jobId));

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after OCR retry." }, 500);

		const retriedJob = detail.ocrJobs.find((ocrJob) => ocrJob.id === jobId);
		if (retriedJob) {
			publishOcrJobRealtimeUpdate(mapOcrJob(retriedJob));
		}

		return c.json({
			data: retriedJob ? mapOcrJob(retriedJob) : null,
		});
	});
}

export function registerPublicScrimRoutes(publicScrimRoutes: Hono<AuthEnv>) {
	publicScrimRoutes.use("*", optionalAuth);

	publicScrimRoutes.get("/", async (c) => {
		const rows = await db.query.scrimTable.findMany({
			where: and(
				inArray(scrimTable.status, PUBLIC_SCRIM_STATUSES),
				isNotNull(scrimTable.awayTeamId)
			),
			with: {
				homeTeam: {
					columns: {
						id: true,
						name: true,
						tag: true,
						organizationId: true,
						avatarUrl: true,
						rating: true,
					},
					with: {
						organization: { columns: { name: true } },
					},
				},
				awayTeam: {
					columns: {
						id: true,
						name: true,
						tag: true,
						organizationId: true,
						avatarUrl: true,
						rating: true,
					},
					with: {
						organization: { columns: { name: true } },
					},
				},
				createdBy: {
					columns: { id: true, displayName: true },
				},
				confirmations: {
					columns: {
						id: true,
						teamId: true,
						status: true,
						disputeReason: true,
						confirmedByUserId: true,
						confirmedAt: true,
						updatedAt: true,
					},
					with: {
						team: {
							columns: { id: true, name: true, tag: true },
						},
						confirmedBy: {
							columns: { id: true, displayName: true },
						},
					},
				},
				ocrJobs: {
					columns: {
						id: true,
						scrimId: true,
						screenshotType: true,
						imageUrl: true,
						status: true,
						progressStage: true,
						errorCode: true,
						errorMessage: true,
						retryCount: true,
						submittedByUserId: true,
						providerName: true,
						providerModel: true,
						promptVersion: true,
						runAfter: true,
						processingTimeMs: true,
						confidenceFlags: true,
						validatedOutput: true,
						startedAt: true,
						completedAt: true,
						createdAt: true,
						updatedAt: true,
					},
					with: {
						submittedBy: {
							columns: { id: true, displayName: true },
						},
					},
					orderBy: [desc(ocrJobTable.createdAt)],
				},
			},
			orderBy: [desc(scrimTable.scheduledAt), desc(scrimTable.createdAt)],
			limit: 50,
		});

		return c.json({
			data: rows.map(mapScrimSummary),
		});
	});
}
