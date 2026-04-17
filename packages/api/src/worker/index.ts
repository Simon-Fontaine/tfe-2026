import { claimNextOcrJob, processClaimedOcrJob } from "@/ocr/process-job";
import logger from "@/utils/logger";
import { sweepExpiredListings } from "@/utils/recruit";

const OCR_WORKER_POLL_INTERVAL_MS = Number(process.env.OCR_WORKER_POLL_INTERVAL_MS ?? 4_000);
const RECRUITMENT_EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let running = true;
let lastExpirySweepAt = 0;

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

async function runWorker() {
	logger.info({ pollIntervalMs: OCR_WORKER_POLL_INTERVAL_MS }, "Starting OCR worker loop.");

	while (running) {
		try {
			await maybeSweepExpiredListings();

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
