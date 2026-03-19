import "dotenv/config";

// dotenv must load before any module that reads process.env
// (db/index.ts reads DATABASE_URL at import time)
import { db } from "..";
import { seedHeroes } from "./heroes";
import { seedMaps } from "./maps";

async function main() {
	console.log("Running seeds…\n");

	await seedHeroes(db);
	await seedMaps(db);

	console.log("\nDone.");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
