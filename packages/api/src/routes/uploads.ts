import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { deleteFile, keyFromUrl, uploadFile } from "@/storage/s3";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BANNER_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const AVATAR_BUCKET = process.env.S3_BUCKET_AVATARS ?? "avatars";
const BANNER_BUCKET = process.env.S3_BUCKET_BANNERS ?? "banners";
const ENTITY_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ENTITY_BANNER_MAX_BYTES = 4 * 1024 * 1024;

const uploadRoutes = new Hono<AuthEnv>();

const ENTITY_UPLOAD_KIND = {
	"org-avatar": { bucket: AVATAR_BUCKET, maxBytes: ENTITY_AVATAR_MAX_BYTES },
	"org-banner": { bucket: BANNER_BUCKET, maxBytes: ENTITY_BANNER_MAX_BYTES },
	"team-avatar": { bucket: AVATAR_BUCKET, maxBytes: ENTITY_AVATAR_MAX_BYTES },
	"team-banner": { bucket: BANNER_BUCKET, maxBytes: ENTITY_BANNER_MAX_BYTES },
} as const;

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
