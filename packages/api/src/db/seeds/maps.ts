import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";

import { requiredEnv } from "@/config/env";
import type { db as Db } from "..";
import { mapTable } from "../schema";
import { createS3Client, ensurePublicBucket, uploadFile } from "./lib/s3";

const BUCKET = requiredEnv("S3_BUCKET_MAPS");
const IMAGES_DIR = join(import.meta.dir, "../../../images/maps");

type MapRow = typeof mapTable.$inferInsert;

const MAPS: MapRow[] = [
	{ id: "blizzard-world", displayName: "Blizzard World", mapType: "hybrid" },
	{ id: "eichenwalde", displayName: "Eichenwalde", mapType: "hybrid" },
	{ id: "hollywood", displayName: "Hollywood", mapType: "hybrid" },
	{ id: "kings-row", displayName: "King's Row", mapType: "hybrid" },
	{ id: "midtown", displayName: "Midtown", mapType: "hybrid" },
	{ id: "numbani", displayName: "Numbani", mapType: "hybrid" },
	{ id: "paraiso", displayName: "Paraíso", mapType: "hybrid" },

	{ id: "circuit-royal", displayName: "Circuit Royal", mapType: "escort" },
	{ id: "dorado", displayName: "Dorado", mapType: "escort" },
	{ id: "havana", displayName: "Havana", mapType: "escort" },
	{ id: "junkertown", displayName: "Junkertown", mapType: "escort" },
	{ id: "rialto", displayName: "Rialto", mapType: "escort" },
	{ id: "route-66", displayName: "Route 66", mapType: "escort" },
	{ id: "shambali-monastery", displayName: "Shambali Monastery", mapType: "escort" },
	{ id: "watchpoint-gibraltar", displayName: "Watchpoint: Gibraltar", mapType: "escort" },

	{ id: "antarctic-peninsula", displayName: "Antarctic Peninsula", mapType: "control" },
	{ id: "busan", displayName: "Busan", mapType: "control" },
	{ id: "ilios", displayName: "Ilios", mapType: "control" },
	{ id: "lijiang-tower", displayName: "Lijiang Tower", mapType: "control" },
	{ id: "nepal", displayName: "Nepal", mapType: "control" },
	{ id: "oasis", displayName: "Oasis", mapType: "control" },
	{ id: "samoa", displayName: "Samoa", mapType: "control" },

	{ id: "colosseo", displayName: "Colosseo", mapType: "push" },
	{ id: "esperanca", displayName: "Esperança", mapType: "push" },
	{ id: "new-queen-street", displayName: "New Queen Street", mapType: "push" },
	{ id: "runasapi", displayName: "Runasapi", mapType: "push" },

	{ id: "aatlis", displayName: "Aatlis", mapType: "flashpoint" },
	{ id: "new-junk-city", displayName: "New Junk City", mapType: "flashpoint" },
	{ id: "suravasa", displayName: "Suravasa", mapType: "flashpoint" },

	{ id: "hanaoka", displayName: "Hanaoka", mapType: "clash" },
	{ id: "throne-of-anubis", displayName: "Throne of Anubis", mapType: "clash" },

	{ id: "hanamura", displayName: "Hanamura", mapType: "assault", isActive: false },
	{
		id: "horizon-lunar-colony",
		displayName: "Horizon Lunar Colony",
		mapType: "assault",
		isActive: false,
	},
	{ id: "paris", displayName: "Paris", mapType: "assault", isActive: false },
	{ id: "temple-of-anubis", displayName: "Temple of Anubis", mapType: "assault", isActive: false },
	{
		id: "volskaya-industries",
		displayName: "Volskaya Industries",
		mapType: "assault",
		isActive: false,
	},
];

export async function seedMaps(db: typeof Db) {
	console.log("Seeding maps…");

	await db.insert(mapTable).values(MAPS).onConflictDoNothing();
	console.log(
		`  ✓ ${MAPS.length} maps seeded (${MAPS.filter((m) => m.isActive !== false).length} active)`
	);

	try {
		await access(IMAGES_DIR);
	} catch {
		console.log("  ~ Map image directory not found; skipped map image upload");
		return;
	}

	const dbMaps = await db.query.mapTable.findMany({ columns: { id: true } });
	const mapIdSet = new Set(dbMaps.map((m) => m.id));
	const s3 = createS3Client();
	await ensurePublicBucket(s3, BUCKET);

	const publicUrl = requiredEnv("S3_PUBLIC_URL").replace(/\/$/, "");
	const files = (await readdir(IMAGES_DIR)).filter((f) => f.endsWith(".webp"));
	const unknown: string[] = [];
	let uploaded = 0;

	for (const file of files) {
		const mapId = file.slice(0, -5);

		if (!mapIdSet.has(mapId)) {
			unknown.push(file);
			continue;
		}

		await uploadFile(s3, {
			Bucket: BUCKET,
			Key: file,
			Body: await readFile(join(IMAGES_DIR, file)),
			ContentType: "image/webp",
		});

		await db
			.update(mapTable)
			.set({ imageUrl: `${publicUrl}/${BUCKET}/${file}` })
			.where(eq(mapTable.id, mapId));

		uploaded++;
	}

	console.log(`  ✓ ${uploaded} map images uploaded`);
	if (unknown.length > 0) {
		console.log(`  ~ Skipped (no matching map in DB): ${unknown.join(", ")}`);
	}
}
