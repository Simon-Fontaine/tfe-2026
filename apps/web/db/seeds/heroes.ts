import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";

import type { db as Db } from "..";
import { heroTable } from "../schema";
import { createS3Client, ensurePublicBucket, uploadFile } from "./lib/s3";

const BUCKET = "heroes";
const IMAGES_DIR = join(__dirname, "../images/heroes");

type HeroRole = "tank" | "damage" | "support";

// Bootstrap list for the initial DB insert. IDs are stable kebab-case slugs —
// never rename them as they are FK'd by playerHeroTable.
const HEROES: { id: string; displayName: string; role: HeroRole }[] = [
	// ─── Tank ────────────────────────────────────────────────────────────────
	{ id: "domina", displayName: "Domina", role: "tank" },
	{ id: "dva", displayName: "D.Va", role: "tank" },
	{ id: "doomfist", displayName: "Doomfist", role: "tank" },
	{ id: "hazard", displayName: "Hazard", role: "tank" },
	{ id: "junker-queen", displayName: "Junker Queen", role: "tank" },
	{ id: "mauga", displayName: "Mauga", role: "tank" },
	{ id: "orisa", displayName: "Orisa", role: "tank" },
	{ id: "ramattra", displayName: "Ramattra", role: "tank" },
	{ id: "reinhardt", displayName: "Reinhardt", role: "tank" },
	{ id: "roadhog", displayName: "Roadhog", role: "tank" },
	{ id: "sigma", displayName: "Sigma", role: "tank" },
	{ id: "winston", displayName: "Winston", role: "tank" },
	{ id: "wrecking-ball", displayName: "Wrecking Ball", role: "tank" },
	{ id: "zarya", displayName: "Zarya", role: "tank" },

	// ─── Damage ──────────────────────────────────────────────────────────────
	{ id: "anran", displayName: "Anran", role: "damage" },
	{ id: "emre", displayName: "Emre", role: "damage" },
	{ id: "vendetta", displayName: "Vendetta", role: "damage" },
	{ id: "ashe", displayName: "Ashe", role: "damage" },
	{ id: "bastion", displayName: "Bastion", role: "damage" },
	{ id: "cassidy", displayName: "Cassidy", role: "damage" },
	{ id: "echo", displayName: "Echo", role: "damage" },
	{ id: "freja", displayName: "Freja", role: "damage" },
	{ id: "genji", displayName: "Genji", role: "damage" },
	{ id: "hanzo", displayName: "Hanzo", role: "damage" },
	{ id: "junkrat", displayName: "Junkrat", role: "damage" },
	{ id: "mei", displayName: "Mei", role: "damage" },
	{ id: "pharah", displayName: "Pharah", role: "damage" },
	{ id: "reaper", displayName: "Reaper", role: "damage" },
	{ id: "sojourn", displayName: "Sojourn", role: "damage" },
	{ id: "soldier-76", displayName: "Soldier: 76", role: "damage" },
	{ id: "sombra", displayName: "Sombra", role: "damage" },
	{ id: "symmetra", displayName: "Symmetra", role: "damage" },
	{ id: "torbjorn", displayName: "Torbjörn", role: "damage" },
	{ id: "tracer", displayName: "Tracer", role: "damage" },
	{ id: "venture", displayName: "Venture", role: "damage" },
	{ id: "widowmaker", displayName: "Widowmaker", role: "damage" },

	// ─── Support ─────────────────────────────────────────────────────────────
	{ id: "jetpack-cat", displayName: "Jetpack Cat", role: "support" },
	{ id: "mizuki", displayName: "Mizuki", role: "support" },
	{ id: "wuyang", displayName: "Wuyang", role: "support" },
	{ id: "ana", displayName: "Ana", role: "support" },
	{ id: "baptiste", displayName: "Baptiste", role: "support" },
	{ id: "brigitte", displayName: "Brigitte", role: "support" },
	{ id: "illari", displayName: "Illari", role: "support" },
	{ id: "juno", displayName: "Juno", role: "support" },
	{ id: "kiriko", displayName: "Kiriko", role: "support" },
	{ id: "life-weaver", displayName: "Lifeweaver", role: "support" },
	{ id: "lucio", displayName: "Lúcio", role: "support" },
	{ id: "mercy", displayName: "Mercy", role: "support" },
	{ id: "moira", displayName: "Moira", role: "support" },
	{ id: "zenyatta", displayName: "Zenyatta", role: "support" },
];

export async function seedHeroes(db: typeof Db): Promise<void> {
	console.log("Seeding heroes…");

	await db
		.insert(heroTable)
		.values(HEROES.map((h) => ({ ...h, isActive: true })))
		.onConflictDoNothing();
	console.log(`  ✓ ${HEROES.length} heroes inserted/skipped`);

	// Use the DB as source of truth so heroes added via admin UI are picked up too.
	const dbHeroes = await db.query.heroTable.findMany({ columns: { id: true } });
	const heroIdSet = new Set(dbHeroes.map((h) => h.id));

	const s3 = createS3Client();
	await ensurePublicBucket(s3, BUCKET);

	const publicUrl = (process.env.S3_PUBLIC_URL ?? "http://localhost:9000").replace(/\/$/, "");
	const files = (await readdir(IMAGES_DIR)).filter((f) => f.endsWith(".png"));
	const unknown: string[] = [];
	let uploaded = 0;

	for (const file of files) {
		const heroId = file.slice(0, -4);

		if (!heroIdSet.has(heroId)) {
			unknown.push(file);
			continue;
		}

		await uploadFile(s3, {
			Bucket: BUCKET,
			Key: file,
			Body: await readFile(join(IMAGES_DIR, file)),
			ContentType: "image/png",
		});

		await db
			.update(heroTable)
			.set({ imageUrl: `${publicUrl}/${BUCKET}/${file}` })
			.where(eq(heroTable.id, heroId));

		uploaded++;
	}

	console.log(`  ✓ ${uploaded} hero images uploaded`);
	if (unknown.length > 0) {
		console.log(`  ~ Skipped (no matching hero in DB): ${unknown.join(", ")}`);
	}
}
