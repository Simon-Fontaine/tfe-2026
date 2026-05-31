export interface CursorPayload {
	id: string;
	createdAt: string;
}

export function encodeCursor(payload: CursorPayload): string {
	return Buffer.from(JSON.stringify({ id: payload.id, createdAt: payload.createdAt })).toString(
		"base64url"
	);
}

export function decodeCursor(cursor: string): CursorPayload {
	const payload = JSON.parse(Buffer.from(cursor, "base64url").toString());
	if (
		typeof payload?.id !== "string" ||
		typeof payload?.createdAt !== "string" ||
		Number.isNaN(Date.parse(payload.createdAt))
	) {
		throw new Error("Invalid cursor.");
	}
	return payload as CursorPayload;
}
