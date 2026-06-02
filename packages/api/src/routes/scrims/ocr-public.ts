import { CreateScrimOcrJobSchema } from "@scrimflow/shared";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { DatabaseError } from "pg";
import * as v from "valibot";
import { db } from "@/db";
import { ocrJobTable, scrimMapTable, scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { createGetSignedUrl, keyFromUrl } from "@/storage/s3";
import { canAccessScrim, canManageAnyScrimTeam } from "./access";
import { PUBLIC_SCRIM_STATUSES } from "./constants";
import { mapOcrJob, mapScrimDetail, mapScrimSummary, publishOcrJobRealtimeUpdate } from "./detail";
import { findScrimWithRelations, ScrimWorkflowError } from "./shared";

const OCR_LOCK_TIMEOUT_MS = 5000;
const SCREENSHOT_BUCKET = process.env.S3_BUCKET_SCREENSHOTS ?? "screenshots";

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
		// Evidence is still useful while a scrim is disputed, so only the terminal
		// completed/cancelled states are blocked here.
		if (scrim.status === "completed" || scrim.status === "cancelled") {
			return c.json(
				{ error: "OCR processing can't be started once a scrim is completed or cancelled." },
				409
			);
		}

		const { screenshotType, imageUrl, scrimMapId } = parsed.output;

		if (screenshotType === "scoreboard") {
			if (!scrimMapId) {
				return c.json(
					{ error: "Scoreboard OCR jobs require a target map identifier (scrimMapId)." },
					400
				);
			}
			const map = await db.query.scrimMapTable.findFirst({
				where: and(eq(scrimMapTable.id, scrimMapId), eq(scrimMapTable.scrimId, scrimId)),
				columns: { id: true },
			});
			if (!map) {
				return c.json({ error: "Target map not found or does not belong to this scrim." }, 404);
			}
		}

		const [existingJob] = await db
			.select({ id: ocrJobTable.id })
			.from(ocrJobTable)
			.where(
				and(
					eq(ocrJobTable.scrimId, scrimId),
					eq(ocrJobTable.imageUrl, imageUrl),
					eq(ocrJobTable.screenshotType, screenshotType),
					inArray(ocrJobTable.status, ["queued", "processing", "completed", "requires_review"])
				)
			)
			.limit(1);
		if (existingJob) {
			return c.json(
				{
					error:
						"An active or completed OCR job already exists for this evidence. Supersede the existing job before submitting a new one.",
				},
				409
			);
		}

		const [job] = await db
			.insert(ocrJobTable)
			.values({
				scrimId,
				submittedByUserId: user.id,
				screenshotType,
				imageUrl,
				scrimMapId: screenshotType === "scoreboard" ? (scrimMapId ?? null) : null,
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
			try {
				publishOcrJobRealtimeUpdate(createdJob);
			} catch {}
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
			return c.json(
				{ error: "Only a team manager can retry OCR jobs for this scrim.", reason: "role" },
				403
			);
		}

		const existingJob = scrim.ocrJobs.find((job) => job.id === jobId);
		if (!existingJob) {
			return c.json({ error: "OCR job not found." }, 404);
		}
		if (existingJob.status === "superseded") {
			return c.json({ error: "Superseded OCR jobs cannot be retried." }, 409);
		}

		try {
			await db.transaction(async (tx) => {
				await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${OCR_LOCK_TIMEOUT_MS}ms'`));
				await tx.execute(sql`select id from ocr_job where id = ${jobId} for update`);

				const [lockedJob] = await tx
					.select({ id: ocrJobTable.id, status: ocrJobTable.status })
					.from(ocrJobTable)
					.where(eq(ocrJobTable.id, jobId));

				if (!lockedJob) throw new ScrimWorkflowError(404, "OCR job not found.");
				if (lockedJob.status === "queued") {
					throw new ScrimWorkflowError(409, "This OCR job is already queued.");
				}
				if (lockedJob.status === "processing") {
					throw new ScrimWorkflowError(409, "This OCR job is already processing.");
				}
				if (lockedJob.status === "superseded") {
					throw new ScrimWorkflowError(409, "Superseded OCR jobs cannot be retried.");
				}

				await tx
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
			});
		} catch (error) {
			if (error instanceof ScrimWorkflowError) {
				return c.json({ error: error.message }, { status: error.status as 404 | 409 });
			}
			if (error instanceof DatabaseError && error.code === "55P03") {
				return c.json({ error: "Temporarily unavailable, please try again." }, 503);
			}
			throw error;
		}

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

	scrimRoutes.get("/:id/ocr-jobs/:jobId/evidence-url", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const jobId = c.req.param("jobId");

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!(await canAccessScrim(user.id, scrim))) {
			return c.json({ error: "You do not have access to this scrim." }, 403);
		}

		const job = scrim.ocrJobs.find((j) => j.id === jobId);
		if (!job) return c.json({ error: "OCR job not found." }, 404);

		const key = keyFromUrl(job.imageUrl, SCREENSHOT_BUCKET);
		if (!key) {
			return c.json({ error: "Evidence URL cannot be resolved to a storage key." }, 422);
		}

		const url = await createGetSignedUrl(SCREENSHOT_BUCKET, key, 1800);
		return c.json({
			data: {
				url,
				expiresAt: new Date(Date.now() + 1800_000).toISOString(),
			},
		});
	});

	scrimRoutes.post("/:id/ocr-jobs/:jobId/supersede", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const jobId = c.req.param("jobId");

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!(await canManageAnyScrimTeam(user.id, scrim))) {
			return c.json(
				{ error: "Only a team manager can supersede OCR jobs for this scrim.", reason: "role" },
				403
			);
		}
		if (scrim.status === "completed" || scrim.status === "cancelled") {
			return c.json(
				{ error: "OCR jobs cannot be superseded for a scrim in this lifecycle state." },
				409
			);
		}

		const existingJob = scrim.ocrJobs.find((job) => job.id === jobId);
		if (!existingJob) return c.json({ error: "OCR job not found." }, 404);

		if (existingJob.status === "superseded") {
			return c.json({ error: "This OCR job has already been superseded." }, 409);
		}
		if (existingJob.status === "queued" || existingJob.status === "processing") {
			return c.json({ error: "OCR jobs that are queued or processing cannot be superseded." }, 409);
		}

		await db.update(ocrJobTable).set({ status: "superseded" }).where(eq(ocrJobTable.id, jobId));

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after supersede." }, 500);

		const updatedJob = detail.ocrJobs.find((j) => j.id === jobId);
		if (updatedJob) {
			try {
				publishOcrJobRealtimeUpdate(mapOcrJob(updatedJob));
			} catch {}
		}

		if (!updatedJob) return c.json({ error: "OCR job not found after supersede." }, 500);
		return c.json({ data: mapOcrJob(updatedJob) });
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
						isArchived: true,
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
						isArchived: true,
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
