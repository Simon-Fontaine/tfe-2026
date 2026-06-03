import {
	type OcrConfidenceFlag,
	type OcrExtractedResult,
	OcrExtractedResultSchema,
} from "@scrimflow/shared";
import { eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { requiredEnv, requiredNumberEnv } from "@/config/env";
import { db } from "@/db";
import { ocrJobTable } from "@/db/schema";
import { createNotification } from "@/notifications";
import { GeminiApiError, requestGeminiStructuredOutput } from "@/ocr/gemini";
import { buildScrimOcrPrompt, OCR_PROMPT_VERSION } from "@/ocr/prompts";
import { buildOcrResponseJsonSchema } from "@/ocr/schema";
import { publishScrimEvent } from "@/realtime/scrim-hub";
import { downloadFile, keyFromUrl } from "@/storage/s3";
import logger from "@/utils/logger";

const SCREENSHOT_BUCKET = requiredEnv("S3_BUCKET_SCREENSHOTS");
const OCR_WORKER_LEASE_SECONDS = requiredNumberEnv("OCR_WORKER_LEASE_SECONDS");
const OCR_WORKER_MAX_RETRIES = requiredNumberEnv("OCR_WORKER_MAX_RETRIES");
const OCR_WORKER_RETRY_BASE_MS = requiredNumberEnv("OCR_WORKER_RETRY_BASE_MS");
const OCR_PROVIDER_NAME = "google-gemini";
const TRANSIENT_PROVIDER_STATUSES = new Set([429, 500, 503, 504]);

type ClaimedOcrJob = typeof ocrJobTable.$inferSelect;

function getLeaseExpiryDate() {
	return new Date(Date.now() + OCR_WORKER_LEASE_SECONDS * 1000);
}

function getRetryDelayMs(retryCount: number) {
	const jitter = Math.floor(Math.random() * 5_000);
	return OCR_WORKER_RETRY_BASE_MS * 2 ** Math.max(retryCount - 1, 0) + jitter;
}

function computeConfidenceFlags(result: OcrExtractedResult): OcrConfidenceFlag[] {
	const flags = new Set<OcrConfidenceFlag>();

	if (result.screenshotType === "game_history") {
		if (result.matches.length === 0) {
			flags.add("incomplete_map_results");
		}
	} else if (
		result.allyTeam.length < 5 ||
		result.enemyTeam.length < 5 ||
		result.allyTeam.some((player) => !player.playerName) ||
		result.enemyTeam.some((player) => !player.playerName)
	) {
		flags.add("incomplete_player_stats");
	}

	if (result.warnings.length > 0) {
		flags.add("manual_review_required");
	}

	return [...flags];
}

function publishJobRealtimeUpdate(params: {
	jobId: string;
	scrimId: string;
	status: "queued" | "processing" | "completed" | "failed" | "requires_review";
	progressStage:
		| "queued"
		| "claimed"
		| "preprocessing"
		| "provider_request"
		| "validating"
		| "requires_review"
		| "completed"
		| "failed";
	errorMessage: string | null;
	retryCount: number;
	processingTimeMs: number | null;
}) {
	publishScrimEvent({
		scrimId: params.scrimId,
		event: "scrim:ocr-job-updated",
		payload: {
			job: {
				jobId: params.jobId,
				scrimId: params.scrimId,
				status: params.status,
				progressStage: params.progressStage,
				errorMessage: params.errorMessage,
				retryCount: params.retryCount,
				processingTimeMs: params.processingTimeMs,
				updatedAt: new Date().toISOString(),
			},
		},
	});
}

async function notifyTerminalOcrJob(params: {
	jobId: string;
	submittedByUserId: string | null;
	status: "completed" | "failed" | "requires_review";
}) {
	if (!params.submittedByUserId) return;
	try {
		const type = params.status === "failed" ? "ocr_failed" : "ocr_completed";
		const title =
			params.status === "completed"
				? "OCR extraction complete"
				: params.status === "requires_review"
					? "OCR extraction needs review"
					: "OCR extraction failed";
		await createNotification({
			userId: params.submittedByUserId,
			type,
			title,
			referenceType: "ocr_job",
			referenceId: params.jobId,
		});
	} catch {}
}

async function setJobStage(
	jobId: string,
	scrimId: string,
	retryCount: number,
	progressStage: "claimed" | "preprocessing" | "provider_request" | "validating"
) {
	await db
		.update(ocrJobTable)
		.set({
			status: "processing",
			progressStage,
			leaseExpiresAt: getLeaseExpiryDate(),
		})
		.where(eq(ocrJobTable.id, jobId));

	publishJobRealtimeUpdate({
		jobId,
		scrimId,
		status: "processing",
		progressStage,
		errorMessage: null,
		retryCount,
		processingTimeMs: null,
	});
}

async function completeJob(params: {
	jobId: string;
	scrimId: string;
	status: "completed" | "requires_review";
	rawOcrOutput: unknown;
	validatedOutput: OcrExtractedResult;
	confidenceFlags: OcrConfidenceFlag[];
	retryCount: number;
	processingTimeMs: number;
	providerModel: string;
}) {
	await db
		.update(ocrJobTable)
		.set({
			status: params.status,
			progressStage: params.status,
			rawOcrOutput: params.rawOcrOutput,
			validatedOutput: params.validatedOutput,
			confidenceFlags: params.confidenceFlags,
			providerName: OCR_PROVIDER_NAME,
			providerModel: params.providerModel,
			promptVersion: OCR_PROMPT_VERSION,
			errorCode: null,
			errorMessage:
				params.status === "requires_review"
					? "Extraction completed but needs manual review before it can be trusted."
					: null,
			processingTimeMs: params.processingTimeMs,
			leaseExpiresAt: null,
			completedAt: new Date(),
		})
		.where(eq(ocrJobTable.id, params.jobId));

	publishJobRealtimeUpdate({
		jobId: params.jobId,
		scrimId: params.scrimId,
		status: params.status,
		progressStage: params.status,
		errorMessage:
			params.status === "requires_review"
				? "Extraction completed but needs manual review before it can be trusted."
				: null,
		retryCount: params.retryCount,
		processingTimeMs: params.processingTimeMs,
	});
}

async function requeueJob(params: {
	job: ClaimedOcrJob;
	errorCode: string | null;
	errorMessage: string;
	rawOcrOutput: unknown;
}) {
	const retryCount = params.job.retryCount + 1;
	const runAfter = new Date(Date.now() + getRetryDelayMs(retryCount));

	await db
		.update(ocrJobTable)
		.set({
			status: "queued",
			progressStage: "queued",
			retryCount,
			errorCode: params.errorCode,
			errorMessage: params.errorMessage,
			rawOcrOutput: params.rawOcrOutput,
			runAfter,
			leaseExpiresAt: null,
			startedAt: null,
			completedAt: null,
		})
		.where(eq(ocrJobTable.id, params.job.id));

	publishJobRealtimeUpdate({
		jobId: params.job.id,
		scrimId: params.job.scrimId,
		status: "queued",
		progressStage: "queued",
		errorMessage: params.errorMessage,
		retryCount,
		processingTimeMs: null,
	});
}

async function failJob(params: {
	jobId: string;
	scrimId: string;
	errorCode: string | null;
	errorMessage: string;
	rawOcrOutput: unknown;
	retryCount: number;
	status?: "failed" | "requires_review";
	processingTimeMs?: number;
}) {
	const status = params.status ?? "failed";
	await db
		.update(ocrJobTable)
		.set({
			status,
			progressStage: status,
			errorCode: params.errorCode,
			errorMessage: params.errorMessage,
			rawOcrOutput: params.rawOcrOutput,
			leaseExpiresAt: null,
			completedAt: new Date(),
			processingTimeMs: params.processingTimeMs ?? null,
			confidenceFlags: status === "requires_review" ? ["manual_review_required"] : [],
		})
		.where(eq(ocrJobTable.id, params.jobId));

	publishJobRealtimeUpdate({
		jobId: params.jobId,
		scrimId: params.scrimId,
		status,
		progressStage: status,
		errorMessage: params.errorMessage,
		retryCount: params.retryCount,
		processingTimeMs: params.processingTimeMs ?? null,
	});
}

export async function claimNextOcrJob(): Promise<ClaimedOcrJob | null> {
	const job = await db.transaction(async (tx) => {
		const candidate = await tx.execute<{ id: string }>(sql`
			select id
			from ocr_job
			where (
				(status = 'queued' and run_after <= now())
				or (status = 'processing' and lease_expires_at is not null and lease_expires_at < now())
			)
			order by run_after asc, created_at asc
			limit 1
			for update skip locked
		`);

		const jobId = candidate.rows[0]?.id;
		if (!jobId) return null;

		const [job] = await tx
			.update(ocrJobTable)
			.set({
				status: "processing",
				progressStage: "claimed",
				errorCode: null,
				errorMessage: null,
				startedAt: new Date(),
				completedAt: null,
				leaseExpiresAt: getLeaseExpiryDate(),
			})
			.where(eq(ocrJobTable.id, jobId))
			.returning();

		return job ?? null;
	});

	if (job) {
		publishJobRealtimeUpdate({
			jobId: job.id,
			scrimId: job.scrimId,
			status: "processing",
			progressStage: "claimed",
			errorMessage: null,
			retryCount: job.retryCount,
			processingTimeMs: null,
		});
	}

	return job;
}

export async function processClaimedOcrJob(job: ClaimedOcrJob) {
	const startedAt = Date.now();

	try {
		await setJobStage(job.id, job.scrimId, job.retryCount, "preprocessing");

		const key = keyFromUrl(job.imageUrl, SCREENSHOT_BUCKET);
		if (!key) {
			await failJob({
				jobId: job.id,
				scrimId: job.scrimId,
				errorCode: "invalid_storage_key",
				errorMessage: "The uploaded evidence URL does not match the configured screenshot bucket.",
				rawOcrOutput: null,
				retryCount: job.retryCount,
			});
			await notifyTerminalOcrJob({
				jobId: job.id,
				submittedByUserId: job.submittedByUserId,
				status: "failed",
			});
			return;
		}

		const file = await downloadFile(SCREENSHOT_BUCKET, key);
		const prompt = buildScrimOcrPrompt(job.screenshotType as OcrExtractedResult["screenshotType"]);

		await setJobStage(job.id, job.scrimId, job.retryCount, "provider_request");
		const geminiResponse = await requestGeminiStructuredOutput({
			prompt,
			imageBuffer: file.buffer,
			mimeType: file.contentType ?? "image/png",
			responseJsonSchema: buildOcrResponseJsonSchema(
				job.screenshotType as OcrExtractedResult["screenshotType"]
			),
		});

		await setJobStage(job.id, job.scrimId, job.retryCount, "validating");
		const parsedPayload = JSON.parse(geminiResponse.text) as unknown;
		const parsed = v.safeParse(OcrExtractedResultSchema, parsedPayload);

		if (!parsed.success) {
			await failJob({
				jobId: job.id,
				scrimId: job.scrimId,
				errorCode: "validation_review_required",
				errorMessage:
					"Extraction returned a payload that needs manual review before it can be trusted.",
				rawOcrOutput: geminiResponse.rawResponse,
				retryCount: job.retryCount,
				status: "requires_review",
				processingTimeMs: Date.now() - startedAt,
			});
			await notifyTerminalOcrJob({
				jobId: job.id,
				submittedByUserId: job.submittedByUserId,
				status: "requires_review",
			});
			return;
		}

		if (parsed.output.screenshotType !== job.screenshotType) {
			await failJob({
				jobId: job.id,
				scrimId: job.scrimId,
				errorCode: "screenshot_type_mismatch",
				errorMessage:
					"Extraction returned a different screenshot type than the queued job and requires manual review.",
				rawOcrOutput: geminiResponse.rawResponse,
				retryCount: job.retryCount,
				status: "requires_review",
				processingTimeMs: Date.now() - startedAt,
			});
			await notifyTerminalOcrJob({
				jobId: job.id,
				submittedByUserId: job.submittedByUserId,
				status: "requires_review",
			});
			return;
		}

		const confidenceFlags = computeConfidenceFlags(parsed.output);
		await completeJob({
			jobId: job.id,
			scrimId: job.scrimId,
			status: confidenceFlags.length > 0 ? "requires_review" : "completed",
			rawOcrOutput: geminiResponse.rawResponse,
			validatedOutput: parsed.output,
			confidenceFlags,
			retryCount: job.retryCount,
			processingTimeMs: Date.now() - startedAt,
			providerModel: geminiResponse.model,
		});
		await notifyTerminalOcrJob({
			jobId: job.id,
			submittedByUserId: job.submittedByUserId,
			status: confidenceFlags.length > 0 ? "requires_review" : "completed",
		});
	} catch (error) {
		if (
			error instanceof GeminiApiError &&
			TRANSIENT_PROVIDER_STATUSES.has(error.status) &&
			job.retryCount < OCR_WORKER_MAX_RETRIES
		) {
			logger.warn(
				{ jobId: job.id, status: error.status, retryCount: job.retryCount + 1 },
				"Retrying OCR job after transient Gemini failure."
			);
			await requeueJob({
				job,
				errorCode: error.code,
				errorMessage: error.message,
				rawOcrOutput: error.rawResponse,
			});
			return;
		}

		if (error instanceof SyntaxError) {
			await failJob({
				jobId: job.id,
				scrimId: job.scrimId,
				errorCode: "invalid_json_response",
				errorMessage: "Gemini returned malformed JSON and the job requires manual review.",
				rawOcrOutput: null,
				retryCount: job.retryCount,
				status: "requires_review",
				processingTimeMs: Date.now() - startedAt,
			});
			await notifyTerminalOcrJob({
				jobId: job.id,
				submittedByUserId: job.submittedByUserId,
				status: "requires_review",
			});
			return;
		}

		await failJob({
			jobId: job.id,
			scrimId: job.scrimId,
			errorCode: error instanceof GeminiApiError ? error.code : "worker_error",
			errorMessage: error instanceof Error ? error.message : "OCR worker failed unexpectedly.",
			rawOcrOutput: error instanceof GeminiApiError ? error.rawResponse : null,
			retryCount: job.retryCount,
			processingTimeMs: Date.now() - startedAt,
		});
		await notifyTerminalOcrJob({
			jobId: job.id,
			submittedByUserId: job.submittedByUserId,
			status: "failed",
		});
	}
}
