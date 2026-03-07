import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { deleteFile, keyFromUrl, uploadFile } from "@/lib/storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BUCKET = process.env.S3_BUCKET_AVATARS ?? "avatars";

export async function POST(request: Request) {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
	}

	const file = formData.get("file");
	if (!(file instanceof Blob)) {
		return NextResponse.json({ error: "No file provided" }, { status: 400 });
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return NextResponse.json(
			{ error: "Only JPEG, PNG and WebP images are allowed" },
			{ status: 400 }
		);
	}

	if (file.size > MAX_BYTES) {
		return NextResponse.json({ error: "File must be smaller than 2 MB" }, { status: 400 });
	}

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const key = `${user.id}/${Date.now()}`;

	// Delete old avatar if one exists
	const userRow = await db.query.userTable.findFirst({
		where: eq(userTable.id, user.id),
		columns: { avatarUrl: true },
	});
	if (userRow?.avatarUrl) {
		const oldKey = keyFromUrl(userRow.avatarUrl, BUCKET);
		if (oldKey) {
			await deleteFile(BUCKET, oldKey).catch(() => {
				// Non-fatal: old file might already be gone
			});
		}
	}

	const url = await uploadFile(BUCKET, key, buffer, file.type);

	await db.update(userTable).set({ avatarUrl: url }).where(eq(userTable.id, user.id));

	return NextResponse.json({ url });
}

export async function DELETE() {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const userRow = await db.query.userTable.findFirst({
		where: eq(userTable.id, user.id),
		columns: { avatarUrl: true },
	});

	if (userRow?.avatarUrl) {
		const oldKey = keyFromUrl(userRow.avatarUrl, BUCKET);
		if (oldKey) {
			await deleteFile(BUCKET, oldKey).catch(() => {});
		}
	}

	await db.update(userTable).set({ avatarUrl: null }).where(eq(userTable.id, user.id));

	return NextResponse.json({ success: true });
}
