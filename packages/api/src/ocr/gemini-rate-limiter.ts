import { requiredNumberEnv } from "@/config/env";
import logger from "@/utils/logger";

/**
 * In-process Gemini rate limiter. `GEMINI_RPM`/`GEMINI_RPD` env vars cap requests
 * per minute (sliding window) and per day (rolling 24h window); 0 = unlimited.
 * Call `waitForSlot()` before each request, then `record()` after — success or
 * failure, since the quota is consumed either way.
 */

const RPM_LIMIT = requiredNumberEnv("GEMINI_RPM");
const RPD_LIMIT = requiredNumberEnv("GEMINI_RPD");
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

class GeminiRateLimiter {
	/** Timestamps (ms) of the last RPM_LIMIT requests, oldest first. */
	private readonly minuteWindow: number[] = [];

	/** Number of requests in the current 24-hour window. */
	private dayCount = 0;

	/** Start of the current 24-hour window (ms). 0 until first request. */
	private dayWindowStart = 0;

	/** Waits until the next call stays within both limits (returns at once if none configured). */
	async waitForSlot(): Promise<void> {
		await this.enforceRpd();
		await this.enforceRpm();
	}

	/** Records one consumed request; call right after `waitForSlot()`, even if the fetch fails. */
	record(): void {
		const now = Date.now();

		if (RPM_LIMIT > 0) {
			this.minuteWindow.push(now);
		}

		if (RPD_LIMIT > 0) {
			if (this.dayWindowStart === 0) {
				this.dayWindowStart = now;
			}
			this.dayCount++;
		}
	}

	private pruneMinuteWindow(now: number): void {
		while (this.minuteWindow.length > 0 && now - (this.minuteWindow[0] as number) >= MINUTE_MS) {
			this.minuteWindow.shift();
		}
	}

	private async enforceRpm(): Promise<void> {
		if (RPM_LIMIT <= 0) return;

		const now = Date.now();
		this.pruneMinuteWindow(now);

		if (this.minuteWindow.length < RPM_LIMIT) return;

		// Window is full — sleep until the oldest slot exits the 60-second window.
		const oldest = this.minuteWindow[0] as number;
		const sleepMs = oldest + MINUTE_MS - now + 100; // +100 ms buffer

		logger.info(
			{ sleepMs, rpm: RPM_LIMIT, windowSize: this.minuteWindow.length },
			"Gemini RPM limit reached — pausing before next request."
		);

		await Bun.sleep(sleepMs);
		this.pruneMinuteWindow(Date.now());
	}

	private async enforceRpd(): Promise<void> {
		if (RPD_LIMIT <= 0) return;

		const now = Date.now();

		// Initialise window on first ever call.
		if (this.dayWindowStart === 0) return;

		// Reset window if 24 h have elapsed since it started.
		if (now - this.dayWindowStart >= DAY_MS) {
			this.dayCount = 0;
			this.dayWindowStart = now;
			return;
		}

		if (this.dayCount < RPD_LIMIT) return;

		const sleepMs = this.dayWindowStart + DAY_MS - now + 100;

		logger.warn(
			{ sleepMs, rpd: RPD_LIMIT, dayCount: this.dayCount },
			"Gemini RPD limit reached — pausing until daily window resets."
		);

		await Bun.sleep(sleepMs);
		this.dayCount = 0;
		this.dayWindowStart = Date.now();
	}
}

export const geminiRateLimiter = new GeminiRateLimiter();
