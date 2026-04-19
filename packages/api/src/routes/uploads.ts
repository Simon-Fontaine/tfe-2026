import {
	CreateScrimEvidenceUploadIntentSchema,
	FinalizeScrimEvidenceUploadSchema,
} from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { scrimTable, userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import {
	buildObjectUrl,
	createPutUploadUrl,
	deleteFile,
	headFile,
	keyFromUrl,
	uploadFile,
} from "@/storage/s3";
import { isUserOnTeam } from "@/utils/team";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BANNER_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const AVATAR_BUCKET = process.env.S3_BUCKET_AVATARS ?? "avatars";
const BANNER_BUCKET = process.env.S3_BUCKET_BANNERS ?? "banners";
const SCREENSHOT_BUCKET = process.env.S3_BUCKET_SCREENSHOTS ?? "screenshots";
const ENTITY_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ENTITY_BANNER_MAX_BYTES = 4 * 1024 * 1024;
const SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;
const SCREENSHOT_TYPES = ["game_history", "scoreboard"] as const;

const uploadRoutes = new Hono<AuthEnv>();

const ENTITY_UPLOAD_KIND = {
	"org-avatar": { bucket: AVATAR_BUCKET, maxBytes: ENTITY_AVATAR_MAX_BYTES },
	"org-banner": { bucket: BANNER_BUCKET, maxBytes: ENTITY_BANNER_MAX_BYTES },
	"team-avatar": { bucket: AVATAR_BUCKET, maxBytes: ENTITY_AVATAR_MAX_BYTES },
	"team-banner": { bucket: BANNER_BUCKET, maxBytes: ENTITY_BANNER_MAX_BYTES },
} as const;

function sanitizeFileName(fileName: string) {
	return fileName
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);
}

async function getScrimAccess(scrimId: string, userId: string) {
	const scrim = await db.query.scrimTable.findFirst({
		where: eq(scrimTable.id, scrimId),
		columns: {
			id: true,
			homeTeamId: true,
			awayTeamId: true,
		},
	});
	if (!scrim) return { scrim: null, canAccess: false };

	const canAccess =
		(await isUserOnTeam(userId, scrim.homeTeamId)) ||
		(scrim.awayTeamId ? await isUserOnTeam(userId, scrim.awayTeamId) : false);

	return { scrim, canAccess };
}

uploadRoutes.post("/assets", async (c) => {
	const user = c.get("user");
	const body = await c.req.parseBody();
	const file = body.file;
	const kind = body.kind;
	if (!(file instanceof File)) return c.json({ error: "No file provided." }, 400);
	if (typeof kind !== "string" || !(kind in ENTITY_UPLOAD_KIND)) {
		return c.json({ error: "Invalid upload kind." }, 400);
	}

	if (!ALLOWED_TYPES.includes(file.type))
		return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);

	const uploadConfig = ENTITY_UPLOAD_KIND[kind as keyof typeof ENTITY_UPLOAD_KIND];
	if (file.size > uploadConfig.maxBytes) {
		return c.json({ error: "File is too large for this image type." }, 400);
	}

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const key = `${user.id}/assets/${kind}/${Date.now()}`;
	const url = await uploadFile(uploadConfig.bucket, key, buffer, file.type);

	return c.json({ url });
});

uploadRoutes.post("/scrim-evidence/intents", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateScrimEvidenceUploadIntentSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { scrim, canAccess } = await getScrimAccess(parsed.output.scrimId, user.id);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!canAccess) {
		return c.json({ error: "You do not have access to upload evidence for this scrim." }, 403);
	}

	const extension =
		parsed.output.contentType === "image/png"
			? "png"
			: parsed.output.contentType === "image/webp"
				? "webp"
				: "jpg";
	const safeFileName =
		sanitizeFileName(parsed.output.fileName.replace(/\.[^.]+$/, "")) || "evidence";
	const objectKey = [
		"private",
		"scrims",
		scrim.id,
		user.id,
		parsed.output.screenshotType,
		`${Date.now()}-${safeFileName}.${extension}`,
	].join("/");

	const upload = await createPutUploadUrl({
		bucket: SCREENSHOT_BUCKET,
		key: objectKey,
		contentType: parsed.output.contentType,
		expiresInSeconds: 900,
	});

	return c.json({
		data: {
			uploadUrl: upload.uploadUrl,
			uploadMethod: "PUT",
			uploadHeaders: {
				"Content-Type": parsed.output.contentType,
			},
			objectKey,
			objectUrl: upload.objectUrl,
			expiresAt: new Date(Date.now() + 900_000).toISOString(),
		},
	});
});

uploadRoutes.post("/scrim-evidence/finalize", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(FinalizeScrimEvidenceUploadSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const { scrim, canAccess } = await getScrimAccess(parsed.output.scrimId, user.id);
	if (!scrim) return c.json({ error: "Scrim not found." }, 404);
	if (!canAccess) {
		return c.json({ error: "You do not have access to finalize evidence for this scrim." }, 403);
	}

	const requiredPrefix = `private/scrims/${scrim.id}/${user.id}/${parsed.output.screenshotType}/`;
	if (!parsed.output.objectKey.startsWith(requiredPrefix)) {
		return c.json(
			{ error: "This upload key does not belong to your scrim evidence session." },
			400
		);
	}

	const object = await headFile(SCREENSHOT_BUCKET, parsed.output.objectKey).catch(() => null);
	if (!object) {
		return c.json({ error: "Uploaded object not found." }, 404);
	}
	if (object.contentType && !ALLOWED_TYPES.includes(object.contentType)) {
		return c.json({ error: "Uploaded evidence has an unsupported content type." }, 400);
	}
	if (object.contentLength && object.contentLength > SCREENSHOT_MAX_BYTES) {
		return c.json({ error: "Uploaded evidence exceeds the 8 MB limit." }, 400);
	}

	return c.json({
		data: {
			objectKey: parsed.output.objectKey,
			url: buildObjectUrl(SCREENSHOT_BUCKET, parsed.output.objectKey),
			contentType: object.contentType,
			sizeBytes: object.contentLength,
		},
	});
});

// ─── Avatar ──────────────────────────────────────────────────────────────────

// POST /avatar — Upload avatar
uploadRoutes.post("/avatar", async (c) => {
	const user = c.get("user");

	const body = await c.req.parseBody();
	const file = body.file;
	if (!(file instanceof File)) return c.json({ error: "No file provided." }, 400);

	if (!ALLOWED_TYPES.includes(file.type))
		return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);
	if (file.size > AVATAR_MAX_BYTES)
		return c.json({ error: "File must be smaller than 2 MB." }, 400);

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const key = `${user.id}/${Date.now()}`;

	// Delete old avatar if one exists
	const userRow = await db.query.userTable.findFirst({
		where: eq(userTable.id, user.id),
		columns: { avatarUrl: true },
	});
	if (userRow?.avatarUrl) {
		const oldKey = keyFromUrl(userRow.avatarUrl, AVATAR_BUCKET);
		if (oldKey) await deleteFile(AVATAR_BUCKET, oldKey).catch(() => {});
	}

	const url = await uploadFile(AVATAR_BUCKET, key, buffer, file.type);
	await db.update(userTable).set({ avatarUrl: url }).where(eq(userTable.id, user.id));

	return c.json({ url });
});

// DELETE /avatar — Delete avatar
uploadRoutes.delete("/avatar", async (c) => {
	const user = c.get("user");

	const userRow = await db.query.userTable.findFirst({
		where: eq(userTable.id, user.id),
		columns: { avatarUrl: true },
	});

	if (userRow?.avatarUrl) {
		const oldKey = keyFromUrl(userRow.avatarUrl, AVATAR_BUCKET);
		if (oldKey) await deleteFile(AVATAR_BUCKET, oldKey).catch(() => {});
	}

	await db.update(userTable).set({ avatarUrl: null }).where(eq(userTable.id, user.id));

	return c.json({ success: true });
});

// ─── Banner ──────────────────────────────────────────────────────────────────

// POST /banner — Upload banner
uploadRoutes.post("/banner", async (c) => {
	const user = c.get("user");

	const body = await c.req.parseBody();
	const file = body.file;
	if (!(file instanceof File)) return c.json({ error: "No file provided." }, 400);

	if (!ALLOWED_TYPES.includes(file.type))
		return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);
	if (file.size > BANNER_MAX_BYTES)
		return c.json({ error: "File must be smaller than 4 MB." }, 400);

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const key = `${user.id}/${Date.now()}`;

	// Delete old banner if one exists
	const userRow = await db.query.userTable.findFirst({
		where: eq(userTable.id, user.id),
		columns: { bannerUrl: true },
	});
	if (userRow?.bannerUrl) {
		const oldKey = keyFromUrl(userRow.bannerUrl, BANNER_BUCKET);
		if (oldKey) await deleteFile(BANNER_BUCKET, oldKey).catch(() => {});
	}

	const url = await uploadFile(BANNER_BUCKET, key, buffer, file.type);
	await db.update(userTable).set({ bannerUrl: url }).where(eq(userTable.id, user.id));

	return c.json({ url });
});

// DELETE /banner — Delete banner
uploadRoutes.delete("/banner", async (c) => {
	const user = c.get("user");

	const userRow = await db.query.userTable.findFirst({
		where: eq(userTable.id, user.id),
		columns: { bannerUrl: true },
	});

	if (userRow?.bannerUrl) {
		const oldKey = keyFromUrl(userRow.bannerUrl, BANNER_BUCKET);
		if (oldKey) await deleteFile(BANNER_BUCKET, oldKey).catch(() => {});
	}

	await db.update(userTable).set({ bannerUrl: null }).where(eq(userTable.id, user.id));

	return c.json({ success: true });
});

export { uploadRoutes };
