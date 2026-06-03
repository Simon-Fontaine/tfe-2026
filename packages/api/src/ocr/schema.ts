import {
	OCR_GAME_MODE_VALUES,
	OCR_HERO_NAME_VALUES,
	OCR_MAP_TYPE_VALUES,
	OCR_MATCH_RESULT_VALUES,
	OCR_MAX_MAP_SCORE,
	OCR_ROLE_VALUES,
	type OcrExtractedResult,
} from "@scrimflow/shared";

const warningSchema = {
	type: "array",
	items: {
		type: "string",
		minLength: 1,
		maxLength: 240,
	},
} as const;

function buildGameHistorySchema() {
	return {
		type: "object",
		additionalProperties: false,
		required: ["screenshotType", "matches", "warnings"],
		properties: {
			screenshotType: {
				type: "string",
				enum: ["game_history"],
			},
			matches: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					required: [
						"matchOrder",
						"mapName",
						"mapType",
						"gameMode",
						"durationText",
						"result",
						"allyScore",
						"enemyScore",
					],
					properties: {
						matchOrder: {
							type: "integer",
							minimum: 1,
							maximum: 20,
						},
						mapName: {
							type: "string",
							minLength: 1,
							maxLength: 120,
						},
						mapType: {
							type: ["string", "null"],
							enum: [...OCR_MAP_TYPE_VALUES, null],
						},
						gameMode: {
							type: ["string", "null"],
							enum: [...OCR_GAME_MODE_VALUES, null],
						},
						durationText: {
							type: ["string", "null"],
							pattern: "^[0-9]{1,2}:[0-9]{2}$",
							maxLength: 12,
						},
						result: {
							type: "string",
							enum: [...OCR_MATCH_RESULT_VALUES],
						},
						allyScore: {
							type: "integer",
							minimum: 0,
							maximum: OCR_MAX_MAP_SCORE,
						},
						enemyScore: {
							type: "integer",
							minimum: 0,
							maximum: OCR_MAX_MAP_SCORE,
						},
					},
				},
			},
			warnings: warningSchema,
		},
	} as const;
}

function buildScoreboardSchema() {
	return {
		type: "object",
		additionalProperties: false,
		required: ["screenshotType", "allyTeam", "enemyTeam", "warnings"],
		properties: {
			screenshotType: {
				type: "string",
				enum: ["scoreboard"],
			},
			allyTeam: {
				type: "array",
				items: buildScoreboardPlayerSchema(),
			},
			enemyTeam: {
				type: "array",
				items: buildScoreboardPlayerSchema(),
			},
			warnings: warningSchema,
		},
	} as const;
}

function buildScoreboardPlayerSchema() {
	return {
		type: "object",
		additionalProperties: false,
		required: [
			"playerName",
			"hero",
			"role",
			"eliminations",
			"assists",
			"deaths",
			"damage",
			"healing",
			"mitigation",
		],
		properties: {
			playerName: {
				type: "string",
				maxLength: 120,
			},
			hero: {
				type: ["string", "null"],
				enum: [...OCR_HERO_NAME_VALUES, null],
			},
			role: {
				type: ["string", "null"],
				enum: [...OCR_ROLE_VALUES, null],
			},
			eliminations: {
				type: "integer",
				minimum: 0,
				maximum: 999999,
			},
			assists: {
				type: "integer",
				minimum: 0,
				maximum: 999999,
			},
			deaths: {
				type: "integer",
				minimum: 0,
				maximum: 999999,
			},
			damage: {
				type: "integer",
				minimum: 0,
				maximum: 999999,
			},
			healing: {
				type: "integer",
				minimum: 0,
				maximum: 999999,
			},
			mitigation: {
				type: "integer",
				minimum: 0,
				maximum: 999999,
			},
		},
	} as const;
}

export function buildOcrResponseJsonSchema(screenshotType: OcrExtractedResult["screenshotType"]) {
	return screenshotType === "scoreboard" ? buildScoreboardSchema() : buildGameHistorySchema();
}
