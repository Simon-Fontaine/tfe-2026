import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";

import logger from "./logger";

// Lazy singleton — avoids SMTP connection attempts at module evaluation time.
let _transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
	if (!_transporter) {
		_transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: Number(process.env.SMTP_PORT ?? 1025),
			secure: process.env.SMTP_SECURE === "true",
			...(process.env.SMTP_USER
				? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
				: {}),
		});
	}
	return _transporter;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMail({
	to,
	subject,
	template,
}: {
	to: string;
	subject: string;
	template: ReactElement;
}) {
	const html = await render(template);

	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

	let lastError: unknown;
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			await getTransporter().sendMail({
				from: process.env.SMTP_FROM,
				to,
				subject,
				html,
				headers: {
					"List-Unsubscribe": `<${appUrl}/settings/notifications>`,
					"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
				},
			});
			return;
		} catch (err) {
			lastError = err;
			if (attempt < MAX_RETRIES) {
				logger.warn({ err, attempt, to, subject }, "email send failed, retrying");
				await sleep(RETRY_DELAY_MS * (attempt + 1));
			}
		}
	}

	logger.error({ err: lastError, to, subject }, "email send failed after retries");
	throw lastError;
}
