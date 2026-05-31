type GeminiCandidatePart = {
	text?: string;
};

type GeminiResponse = {
	candidates?: Array<{
		content?: {
			parts?: GeminiCandidatePart[];
		};
		finishReason?: string;
	}>;
};

import { geminiRateLimiter } from "@/ocr/gemini-rate-limiter";

export class GeminiApiError extends Error {
	status: number;
	code: string | null;
	rawResponse: unknown;

	constructor(message: string, status: number, code: string | null, rawResponse: unknown) {
		super(message);
		this.name = "GeminiApiError";
		this.status = status;
		this.code = code;
		this.rawResponse = rawResponse;
	}
}

export function getGeminiModel() {
	return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}

export async function requestGeminiStructuredOutput(params: {
	prompt: string;
	imageBuffer: Buffer;
	mimeType: string;
	responseJsonSchema: Record<string, unknown>;
}) {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY is not configured.");
	}

	// Honour RPM / RPD limits before consuming a quota slot.
	await geminiRateLimiter.waitForSlot();
	geminiRateLimiter.record();

	const model = getGeminiModel();
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-goog-api-key": apiKey,
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{
								text: params.prompt,
							},
							{
								inline_data: {
									mime_type: params.mimeType,
									data: params.imageBuffer.toString("base64"),
								},
							},
						],
					},
				],
				generationConfig: {
					temperature: 0,
					responseMimeType: "application/json",
					responseJsonSchema: params.responseJsonSchema,
				},
			}),
			signal: AbortSignal.timeout(45_000),
		}
	);

	const rawResponse = (await response.json().catch(() => null)) as Record<string, unknown> | null;
	if (!response.ok) {
		throw new GeminiApiError(
			typeof rawResponse?.error === "object" &&
				rawResponse.error !== null &&
				"message" in rawResponse.error &&
				typeof rawResponse.error.message === "string"
				? rawResponse.error.message
				: `Gemini request failed with status ${response.status}.`,
			response.status,
			typeof rawResponse?.error === "object" &&
				rawResponse.error !== null &&
				"status" in rawResponse.error &&
				typeof rawResponse.error.status === "string"
				? rawResponse.error.status
				: null,
			rawResponse
		);
	}

	const parsed = rawResponse as GeminiResponse | null;
	const text = parsed?.candidates?.[0]?.content?.parts?.find(
		(part) => typeof part.text === "string"
	)?.text;

	if (!text) {
		throw new GeminiApiError("Gemini returned no structured JSON payload.", 502, null, rawResponse);
	}

	return {
		model,
		rawResponse,
		text,
	};
}
