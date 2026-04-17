import type { OcrExtractedResult } from "@scrimflow/shared";

export const OCR_PROMPT_VERSION = "ow2-scrim-v2";

function buildGameHistoryPrompt() {
	return `<role>
You are a highly precise multimodal extraction assistant specialized in Overwatch 2 game reports.
</role>

<task>
Analyze one Overwatch 2 game-history screenshot and extract the visible match rows into a single JSON object.
</task>

<data_mapping>
1. Process rows from top to bottom.
2. Include only rows that are visibly present in the screenshot.
3. Use one JSON item per visible row in the matches array.
4. Treat the left score as allyScore and the right score as enemyScore.
</data_mapping>

<field_rules>
- screenshotType must always be "game_history".
- matchOrder is the 1-based visual order from top to bottom.
- mapName must be the visible map text normalized to the exact schema enum/string style when possible.
- mapType must come from the icon or known map association. Use null when you cannot determine it safely.
- gameMode must come from the visible queue or lobby label. Use null when unreadable.
- durationText must be only the trailing match duration in MM:SS format. Use null when unreadable.
- result must be one of victory, defeat, or draw.
- allyScore and enemyScore must be integers parsed from the visible X-Y score string. Use 0 only when the score is unreadable.
- warnings should contain short human-readable notes only when something important was partially unreadable or ambiguous.
</field_rules>

<constraints>
- Return JSON only. Do not wrap it in markdown.
- Match the provided schema exactly.
- Do not invent rows, maps, queue names, or scores that are not visible.
- If no usable rows are visible, return {"screenshotType":"game_history","matches":[],"warnings":["No visible match rows found."]}.
</constraints>`;
}

function buildScoreboardPrompt() {
	return `<role>
You are a highly precise multimodal extraction assistant specialized in Overwatch 2 scoreboards.
</role>

<task>
Analyze one Overwatch 2 scoreboard screenshot and extract the visible player stats into a single JSON object.
</task>

<data_mapping>
1. The scoreboard is split by the horizontal VS divider.
2. allyTeam contains the visible player rows above the divider.
3. enemyTeam contains the visible player rows below the divider.
4. Preserve top-to-bottom visual order for both teams.
</data_mapping>

<field_rules>
- screenshotType must always be "scoreboard".
- role must be derived from the far-left icon. Use null when the icon is unclear.
- playerName must be the primary player name only. Ignore clan tags, subtitles, and decorative text.
- hero must match the provided schema enum exactly. Use null when the portrait is unclear.
- eliminations, assists, deaths, damage, healing, and mitigation must be integers with commas removed.
- If a numeric stat is blank or unreadable, return 0.
- warnings should contain short human-readable notes only when important rows or fields were partially unreadable.
</field_rules>

<constraints>
- Return JSON only. Do not wrap it in markdown.
- Match the provided schema exactly.
- Do not invent players or stats that are not visible.
- If a player row is partially visible, extract the visible fields conservatively and use null or 0 fallbacks as required by the schema.
- If no usable player rows are visible, return {"screenshotType":"scoreboard","allyTeam":[],"enemyTeam":[],"warnings":["No visible scoreboard rows found."]}.
</constraints>`;
}

export function buildScrimOcrPrompt(screenshotType: OcrExtractedResult["screenshotType"]) {
	return screenshotType === "scoreboard" ? buildScoreboardPrompt() : buildGameHistoryPrompt();
}
