import { requiredNumberEnv } from "@/config/env";
import { claimNextOcrJob, processClaimedOcrJob } from "@/ocr/process-job";
import { deleteExpiredSessions, purgeScheduledAccountDeletions } from "@/utils/compliance";
import logger from "@/utils/logger";
import { sweepExpiredListings } from "@/utils/recruit";

const OCR_WORKER_POLL_INTERVAL_MS = requiredNumberEnv("OCR_WORKER_POLL_INTERVAL_MS");
const RECRUITMENT_EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const ACCOUNT_DELETION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_CLEANUP_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

let running = true;
let lastExpirySweepAt = 0;
let lastAccountDeletionSweepAt = 0;
let lastSessionCleanupSweepAt = 0;

process.on("SIGINT", () => {
	running = false;
});

process.on("SIGTERM", () => {
	running = false;
});

async function maybeSweepExpiredListings() {
	const now = Date.now();
	if (lastExpirySweepAt !== 0 && now - lastExpirySweepAt < RECRUITMENT_EXPIRY_SWEEP_INTERVAL_MS) {
		return;
	}

	lastExpirySweepAt = now;

	const expiredListingCount = await sweepExpiredListings();
	logger.info(
		{ expiredListingCount, sweepIntervalMs: RECRUITMENT_EXPIRY_SWEEP_INTERVAL_MS },
		"Completed recruitment listing expiry sweep."
	);
}

async function maybePurgeScheduledAccountDeletions() {
	const now = Date.now();
	if (
		lastAccountDeletionSweepAt !== 0 &&
		now - lastAccountDeletionSweepAt < ACCOUNT_DELETION_SWEEP_INTERVAL_MS
	) {
		return;
	}

	lastAccountDeletionSweepAt = now;

	const result = await purgeScheduledAccountDeletions(new Date(now));
	logger.info(
		{
			...result,
			sweepIntervalMs: ACCOUNT_DELETION_SWEEP_INTERVAL_MS,
		},
		"Completed scheduled account deletion sweep."
	);
}

async function maybeDeleteExpiredSessions() {
	const now = Date.now();
	if (
		lastSessionCleanupSweepAt !== 0 &&
		now - lastSessionCleanupSweepAt < SESSION_CLEANUP_SWEEP_INTERVAL_MS
	) {
		return;
	}

	lastSessionCleanupSweepAt = now;

	const deletedSessionCount = await deleteExpiredSessions(new Date(now));
	logger.info(
		{ deletedSessionCount, sweepIntervalMs: SESSION_CLEANUP_SWEEP_INTERVAL_MS },
		"Completed expired session cleanup sweep."
	);
}

async function runWorker() {
	logger.info({ pollIntervalMs: OCR_WORKER_POLL_INTERVAL_MS }, "Starting OCR worker loop.");

	while (running) {
		try {
			await maybeSweepExpiredListings();
			await maybePurgeScheduledAccountDeletions();
			await maybeDeleteExpiredSessions();

			const job = await claimNextOcrJob();
			if (!job) {
				await Bun.sleep(OCR_WORKER_POLL_INTERVAL_MS);
				continue;
			}

			logger.info(
				{ jobId: job.id, scrimId: job.scrimId, screenshotType: job.screenshotType },
				"Claimed OCR job."
			);
			await processClaimedOcrJob(job);
		} catch (error) {
			logger.error({ error }, "OCR worker loop failed.");
			await Bun.sleep(OCR_WORKER_POLL_INTERVAL_MS);
		}
	}

	logger.info("OCR worker loop stopped.");
}

await runWorker();
