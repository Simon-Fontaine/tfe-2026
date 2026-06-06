const SCRIM_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "medium",
	timeStyle: "short",
});

/** Shared timestamp formatter for scrim surfaces. */
export function formatScrimTimestamp(value: string | null, emptyLabel = "Not set") {
	if (!value) return emptyLabel;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? emptyLabel : SCRIM_DATE_TIME_FORMATTER.format(date);
}

export function formatSeriesFormat(config: { format?: string | null; bestOf?: number | null }) {
	return config.format ?? `Best of ${config.bestOf ?? 5}`;
}

/** ISO string → value accepted by `<input type="datetime-local">`. */
export function toDateTimeLocal(value: string | null) {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
		date.getHours()
	)}:${pad(date.getMinutes())}`;
}

/** `<input type="datetime-local">` value → ISO string (or `undefined` when empty/invalid). */
export function toIsoTimestamp(value: string) {
	if (!value) return undefined;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
