import { and, eq } from "drizzle-orm";
import Redis from "ioredis";
import { db } from "@/db";
import { ocrJobTable, organizationTable, scrimTable, teamTable, userTable } from "@/db/schema";
import { buildObjectUrl, ensureBucketPublicPolicy, uploadFile } from "@/storage/s3";

const SCREENSHOT_BUCKET = process.env.S3_BUCKET_SCREENSHOTS ?? "screenshots";
const TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

const FIXTURE_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64"
);

async function checkRedis(): Promise<void> {
	const redisUrl = process.env.REDIS_URL;
	if (!redisUrl) {
		console.error("❌ Redis connection failed: REDIS_URL is not set.");
		process.exit(1);
	}

	const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
	try {
		await redis.connect();
		await redis.ping();
		console.log("✅ Redis connection healthy.");
	} catch (err) {
		console.error(
			`❌ Redis connection failed: ${err instanceof Error ? err.message : String(err)}`
		);
		process.exit(1);
	} finally {
		redis.disconnect();
	}
}

async function seedMinioFixture(): Promise<string> {
	await ensureBucketPublicPolicy(SCREENSHOT_BUCKET);
	await uploadFile(SCREENSHOT_BUCKET, "test/ocr-validate-fixture.png", FIXTURE_PNG, "image/png");
	const url = buildObjectUrl(SCREENSHOT_BUCKET, "test/ocr-validate-fixture.png");
	console.log("✅ MinIO fixture seeded.");
	return url;
}

async function seedDbFixtures(): Promise<string> {
	const [user] = await db
		.insert(userTable)
		.values({
			email: "ocr-validate@test.scrimflow.local",
			username: "ocr-validate-bot",
			displayName: "OCR Validate Bot",
			emailVerified: true,
			isBanned: false,
			requiresReverification: false,
		})
		.onConflictDoUpdate({
			target: userTable.email,
			set: { displayName: "OCR Validate Bot" },
		})
		.returning({ id: userTable.id });

	if (!user) throw new Error("Failed to upsert test user");

	const [org] = await db
		.insert(organizationTable)
		.values({ name: "OCR Validate Org", slug: "ocr-validate-org", ownerId: user.id })
		.onConflictDoUpdate({
			target: organizationTable.slug,
			set: { name: "OCR Validate Org" },
		})
		.returning({ id: organizationTable.id });

	if (!org) throw new Error("Failed to upsert test org");

	const existingTeam = await db.query.teamTable.findFirst({
		where: and(eq(teamTable.organizationId, org.id), eq(teamTable.name, "OCR Validate Team")),
	});

	const team =
		existingTeam ??
		(await db
			.insert(teamTable)
			.values({ organizationId: org.id, name: "OCR Validate Team", tag: "OCR" })
			.returning({ id: teamTable.id })
			.then((rows) => rows[0]));

	if (!team) throw new Error("Failed to upsert test team");

	const existingScrim = await db.query.scrimTable.findFirst({
		where: eq(scrimTable.homeTeamId, team.id),
	});

	const scrim =
		existingScrim ??
		(await db
			.insert(scrimTable)
			.values({ homeTeamId: team.id })
			.returning({ id: scrimTable.id })
			.then((rows) => rows[0]));

	if (!scrim) throw new Error("Failed to upsert test scrim");

	console.log("✅ DB fixtures seeded.");
	return scrim.id;
}

async function insertOcrJob(scrimId: string, imageUrl: string): Promise<string> {
	const [job] = await db
		.insert(ocrJobTable)
		.values({
			scrimId,
			screenshotType: "game_history",
			imageUrl,
			runAfter: new Date(),
		})
		.returning({ id: ocrJobTable.id });

	if (!job) throw new Error("Failed to insert OCR job");
	console.log(`✅ OCR job inserted: ${job.id}`);
	return job.id;
}

async function pollJob(jobId: string): Promise<void> {
	const startTime = Date.now();

	while (Date.now() - startTime < TIMEOUT_MS) {
		await Bun.sleep(POLL_INTERVAL_MS);

		const job = await db.query.ocrJobTable.findFirst({
			where: eq(ocrJobTable.id, jobId),
		});

		if (!job) {
			console.error("❌ OCR job not found in DB.");
			process.exit(1);
		}

		if (job.status === "completed" || job.status === "requires_review") {
			const elapsed = Date.now() - startTime;
			console.log(`✅ OCR job completed in ${elapsed}ms`);
			console.log(JSON.stringify(job.validatedOutput, null, 2));
			process.exit(0);
		}

		if (job.status === "failed") {
			console.error(`❌ OCR job failed: ${job.errorMessage}`);
			process.exit(1);
		}
	}

	const job = await db.query.ocrJobTable.findFirst({
		where: eq(ocrJobTable.id, jobId),
	});
	console.error(
		`Timed out after 60s. Job status: ${job?.status ?? "unknown"}. Is the worker running? (pnpm dev:worker)`
	);
	process.exit(1);
}

async function main(): Promise<void> {
	console.log("🔍 Validating OCR worker...\n");

	await checkRedis();
	const imageUrl = await seedMinioFixture();
	const scrimId = await seedDbFixtures();
	const jobId = await insertOcrJob(scrimId, imageUrl);

	console.log(`\n⏳ Polling OCR job ${jobId} (timeout: 60s)...\n`);
	await pollJob(jobId);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
