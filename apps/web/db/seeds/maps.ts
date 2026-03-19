import type { db as Db } from "..";
import { mapTable } from "../schema";

type MapRow = typeof mapTable.$inferInsert;

const MAPS: MapRow[] = [
	// ─── Hybrid ───────────────────────────────────────────────────────────────
	{ id: "blizzard-world", displayName: "Blizzard World", mapType: "hybrid" },
	{ id: "eichenwalde", displayName: "Eichenwalde", mapType: "hybrid" },
	{ id: "hollywood", displayName: "Hollywood", mapType: "hybrid" },
	{ id: "kings-row", displayName: "King's Row", mapType: "hybrid" },
	{ id: "midtown", displayName: "Midtown", mapType: "hybrid" },
	{ id: "numbani", displayName: "Numbani", mapType: "hybrid" },
	{ id: "paraiso", displayName: "Paraíso", mapType: "hybrid" },

	// ─── Escort ───────────────────────────────────────────────────────────────
	{ id: "circuit-royal", displayName: "Circuit Royal", mapType: "escort" },
	{ id: "dorado", displayName: "Dorado", mapType: "escort" },
	{ id: "havana", displayName: "Havana", mapType: "escort" },
	{ id: "junkertown", displayName: "Junkertown", mapType: "escort" },
	{ id: "rialto", displayName: "Rialto", mapType: "escort" },
	{ id: "route-66", displayName: "Route 66", mapType: "escort" },
	{ id: "shambali-monastery", displayName: "Shambali Monastery", mapType: "escort" },
	{ id: "watchpoint-gibraltar", displayName: "Watchpoint: Gibraltar", mapType: "escort" },

	// ─── Control ──────────────────────────────────────────────────────────────
	{ id: "antarctic-peninsula", displayName: "Antarctic Peninsula", mapType: "control" },
	{ id: "busan", displayName: "Busan", mapType: "control" },
	{ id: "ilios", displayName: "Ilios", mapType: "control" },
	{ id: "lijiang-tower", displayName: "Lijiang Tower", mapType: "control" },
	{ id: "nepal", displayName: "Nepal", mapType: "control" },
	{ id: "oasis", displayName: "Oasis", mapType: "control" },
	{ id: "samoa", displayName: "Samoa", mapType: "control" },

	// ─── Push ─────────────────────────────────────────────────────────────────
	{ id: "colosseo", displayName: "Colosseo", mapType: "push" },
	{ id: "esperanca", displayName: "Esperança", mapType: "push" },
	{ id: "new-queen-street", displayName: "New Queen Street", mapType: "push" },
	{ id: "runasapi", displayName: "Runasapi", mapType: "push" },

	// ─── Flashpoint ───────────────────────────────────────────────────────────
	{ id: "new-junk-city", displayName: "New Junk City", mapType: "flashpoint" },
	{ id: "suravasa", displayName: "Suravasa", mapType: "flashpoint" },

	// ─── Clash ────────────────────────────────────────────────────────────────
	{ id: "hanaoka", displayName: "Hanaoka", mapType: "clash" },
	{ id: "throne-of-anubis", displayName: "Throne of Anubis", mapType: "clash" },

	// ─── Assault (legacy — removed from competitive, kept for history) ─────────
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
}
