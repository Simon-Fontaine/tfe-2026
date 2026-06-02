/**
 * Demo seed — creates realistic OWL-inspired orgs, teams, and players for demos.
 *
 * Run with:  pnpm db:seed:demo
 *
 * All accounts share the same password: Scrimflow1!
 * Emails follow the pattern {username}@scrimflow.com
 *
 * ── Image conventions ────────────────────────────────────────────────────────
 * Drop images into the directories below. The seed picks them up automatically.
 * Files missing from the directory are silently skipped — nothing breaks.
 *
 *   packages/api/images/demo/players/
 *     {username}.webp          → player avatar   (also accepts .png)
 *     {username}-banner.webp   → player banner   (also accepts .png)
 *
 *   packages/api/images/demo/teams/
 *     {tag-lowercase}.webp     → team avatar     (shck, sfs2, dal, dalc)
 *     {tag-lowercase}-banner.webp → team banner
 *
 *   packages/api/images/demo/orgs/
 *     {slug}.webp              → org avatar      (sf-shock, dallas-fuel)
 *     {slug}-banner.webp       → org banner
 */

import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { and, eq, ne } from "drizzle-orm";

import { hashPassword } from "@/auth/password";
import { db } from "@/db";
import {
	availabilityTable,
	organizationMemberTable,
	organizationTable,
	playerHeroTable,
	playerProfileTable,
	recruitmentListingTable,
	teamRosterTable,
	teamTable,
	updatePostTable,
	userTable,
} from "@/db/schema";
import { createS3Client, ensurePublicBucket, uploadFile } from "./lib/s3";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEMO_PASSWORD = "Scrimflow1!";
const EMAIL_DOMAIN = "scrimflow.com";

const DEMO_IMAGES_ROOT = join(import.meta.dir, "../../../images/demo");
const SUPPORTED_EXTS = [".webp", ".png", ".jpg", ".jpeg"] as const;

function imageContentType(filename: string): string {
	if (filename.endsWith(".webp")) return "image/webp";
	if (filename.endsWith(".png")) return "image/png";
	return "image/jpeg";
}

/**
 * Uploads avatars and banners from a local directory to an S3 bucket and
 * calls the provided DB setter for each image found.
 *
 * File naming:
 *   {key}.webp / {key}.png        → avatar
 *   {key}-banner.webp / .png      → banner
 *
 * Gracefully skips if the directory doesn't exist.
 */
async function uploadEntityImages(params: {
	dir: string;
	bucket: string;
	publicUrl: string;
	entities: Array<{
		key: string;
		// Awaited only for its side effect; Drizzle query builders are thenable, so accept any
		// PromiseLike rather than forcing callers to wrap them in Promise<void>.
		setAvatar: (url: string) => PromiseLike<unknown>;
		setBanner: (url: string) => PromiseLike<unknown>;
	}>;
}): Promise<{ uploaded: number; skipped: string[] }> {
	const { dir, bucket, publicUrl, entities } = params;

	// Gracefully skip if the images directory doesn't exist yet.
	try {
		await access(dir);
	} catch {
		return { uploaded: 0, skipped: [] };
	}

	const s3 = createS3Client();
	await ensurePublicBucket(s3, bucket);

	const files = await readdir(dir);
	const keyMap = new Map(entities.map((e) => [e.key, e]));
	const skipped: string[] = [];
	let uploaded = 0;

	for (const file of files) {
		// Determine whether this is an avatar or a banner, and extract the key.
		const ext = SUPPORTED_EXTS.find((e) => file.endsWith(e));
		if (!ext) continue;

		const stem = file.slice(0, -ext.length); // filename without extension
		const isBanner = stem.endsWith("-banner");
		const entityKey = isBanner ? stem.slice(0, -"-banner".length) : stem;

		const entity = keyMap.get(entityKey);
		if (!entity) {
			skipped.push(file);
			continue;
		}

		const body = await readFile(join(dir, file));
		await uploadFile(s3, {
			Bucket: bucket,
			Key: file,
			Body: body,
			ContentType: imageContentType(file),
		});

		const url = `${publicUrl}/${bucket}/${file}`;
		if (isBanner) {
			await entity.setBanner(url);
		} else {
			await entity.setAvatar(url);
		}
		uploaded++;
	}

	return { uploaded, skipped };
}

// ─── User definitions ───────────────────────────────────────────────────────

type PlayerData = {
	username: string;
	displayName: string;
	bio: string;
	socialLinks: Record<string, string>;
	battletag: string;
	primaryRole: "tank" | "damage" | "support";
	secondaryRole?: "tank" | "damage" | "support";
	rank: "grandmaster" | "master" | "diamond" | "champion";
	rankDivision: number;
	participationIntent: "find_team" | "recruit_players" | "schedule_scrims" | "just_browsing";
	heroes: string[];
};

const PLAYERS: Record<string, PlayerData> = {
	// ── SF Shock Main ──────────────────────────────────────────────────────────

	smurf: {
		username: "smurf",
		displayName: "Smurf",
		bio: "Main tank for San Francisco Shock. Two-time OWL Grand Finals champion. Known for aggressive D.Va play and mechanical tank mastery.",
		socialLinks: { twitter: "@smurf_ow", discord: "Smurf#0001" },
		battletag: "Smurf#11558",
		primaryRole: "tank",
		rank: "grandmaster",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["dva", "sigma", "orisa", "reinhardt", "winston"],
	},

	viol2t: {
		username: "viol2t",
		displayName: "Viol2t",
		bio: "Flex tank player for San Francisco Shock. Exceptional off-angle sigma and zarya play. Former support turned tank specialist.",
		socialLinks: { twitter: "@viol2t" },
		battletag: "Viol2t#11390",
		primaryRole: "tank",
		secondaryRole: "support",
		rank: "grandmaster",
		rankDivision: 2,
		participationIntent: "schedule_scrims",
		heroes: ["sigma", "zarya", "dva", "ramattra", "roadhog"],
	},

	proper: {
		username: "proper",
		displayName: "Proper",
		bio: "Hitscan DPS for SF Shock. One of the most consistent tracer and sojourn players in the league. Known for clutch plays under pressure.",
		socialLinks: { twitter: "@properow", discord: "Proper#1234" },
		battletag: "Proper#11243",
		primaryRole: "damage",
		rank: "grandmaster",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["tracer", "sojourn", "cassidy", "soldier-76", "sombra"],
	},

	krakinlakin: {
		username: "krakinlakin",
		displayName: "Krakinlakin",
		bio: "Flex DPS for San Francisco Shock. Norwegian mechanical prodigy specialising in genji and echo. Strong team fight presence.",
		socialLinks: { twitter: "@krakinlakin" },
		battletag: "Krakinlakin#2912",
		primaryRole: "damage",
		secondaryRole: "tank",
		rank: "grandmaster",
		rankDivision: 4,
		participationIntent: "schedule_scrims",
		heroes: ["genji", "echo", "tracer", "venture", "sojourn"],
	},

	moth: {
		username: "moth",
		displayName: "Moth",
		bio: "Main support for San Francisco Shock. Veteran support player renowned for precise sleep darts and consistent ana performance. Heart of the Shock lineup.",
		socialLinks: { twitter: "@moth_ow", discord: "Moth#0420" },
		battletag: "Moth#11563",
		primaryRole: "support",
		rank: "grandmaster",
		rankDivision: 4,
		participationIntent: "schedule_scrims",
		heroes: ["ana", "mercy", "lucio", "baptiste", "life-weaver"],
	},

	shqote: {
		username: "shqote",
		displayName: "ShQotE",
		bio: "Flex support for SF Shock. Exceptional kiriko and zenyatta mechanics. Provides strong utility and peel for the team.",
		socialLinks: { twitter: "@shqote" },
		battletag: "ShQotE#3671",
		primaryRole: "support",
		secondaryRole: "damage",
		rank: "grandmaster",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["kiriko", "zenyatta", "baptiste", "brigitte", "ana"],
	},

	// ── SF Shock Academy ──────────────────────────────────────────────────────

	aznrite: {
		username: "aznrite",
		displayName: "AznRite",
		bio: "DPS player for SF Shock Academy. High mechanical ceiling with exceptional tracer and sombra. Looking to break into the main roster.",
		socialLinks: { twitter: "@aznrite_ow" },
		battletag: "AznRite#1894",
		primaryRole: "damage",
		rank: "master",
		rankDivision: 2,
		participationIntent: "schedule_scrims",
		heroes: ["tracer", "sombra", "genji", "sojourn", "echo"],
	},

	kalios: {
		username: "kalios",
		displayName: "Kalios",
		bio: "Tank player for SF Shock Academy. Consistent reinhardt and sigma fundamentals with great game sense.",
		socialLinks: {},
		battletag: "Kalios#2233",
		primaryRole: "tank",
		rank: "master",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["reinhardt", "sigma", "orisa", "winston", "ramattra"],
	},

	alarm: {
		username: "alarm",
		displayName: "Alarm",
		bio: "Support player for SF Shock Academy. Versatile healer with excellent positioning and target prioritisation.",
		socialLinks: { twitter: "@alarm_ow" },
		battletag: "Alarm#11494",
		primaryRole: "support",
		rank: "master",
		rankDivision: 2,
		participationIntent: "schedule_scrims",
		heroes: ["ana", "kiriko", "lucio", "mercy", "zenyatta"],
	},

	leyton: {
		username: "leyton",
		displayName: "Leyton",
		bio: "Flex support for SF Shock Academy. Strong brigitte and lucio player — brings the energy on speed-boosted dives.",
		socialLinks: {},
		battletag: "Leyton#9418",
		primaryRole: "support",
		secondaryRole: "tank",
		rank: "master",
		rankDivision: 4,
		participationIntent: "schedule_scrims",
		heroes: ["brigitte", "lucio", "kiriko", "baptiste", "moira"],
	},

	hadi: {
		username: "hadi",
		displayName: "Hadi",
		bio: "Off-tank for SF Shock Academy. Excels at DVa bomb timing and zarya charge management.",
		socialLinks: {},
		battletag: "Hadi#12304",
		primaryRole: "tank",
		secondaryRole: "damage",
		rank: "master",
		rankDivision: 4,
		participationIntent: "schedule_scrims",
		heroes: ["dva", "zarya", "junker-queen", "roadhog", "sigma"],
	},

	// ── Dallas Fuel Main ──────────────────────────────────────────────────────

	hanbin: {
		username: "hanbin",
		displayName: "Hanbin",
		bio: "Main tank for Dallas Fuel. Dominant Sigma and Orisa player known for pinpoint accuracy and unshakeable composure. Team leader on and off the server.",
		socialLinks: { twitter: "@hanbin_ow", discord: "Hanbin#0002" },
		battletag: "Hanbin#3155",
		primaryRole: "tank",
		rank: "grandmaster",
		rankDivision: 2,
		participationIntent: "schedule_scrims",
		heroes: ["sigma", "orisa", "dva", "ramattra", "reinhardt"],
	},

	fielder: {
		username: "fielder",
		displayName: "Fielder",
		bio: "Flex DPS for Dallas Fuel. Creative genji and echo player with exceptional game sense. Thrives on dive compositions.",
		socialLinks: { twitter: "@fielder_ow" },
		battletag: "Fielder#2887",
		primaryRole: "damage",
		rank: "grandmaster",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["genji", "echo", "tracer", "venture", "sojourn"],
	},

	doha: {
		username: "doha",
		displayName: "Doha",
		bio: "Hitscan DPS for Dallas Fuel. Lethal sojourn and soldier-76 mechanics. One of the highest raw-aim DPS players in competitive.",
		socialLinks: { twitter: "@doha_ow" },
		battletag: "Doha#2712",
		primaryRole: "damage",
		rank: "grandmaster",
		rankDivision: 2,
		participationIntent: "schedule_scrims",
		heroes: ["sojourn", "soldier-76", "cassidy", "tracer", "widowmaker"],
	},

	kariv: {
		username: "kariv",
		displayName: "KariV",
		bio: "Veteran flex support for Dallas Fuel. French support icon with eight years of OWL experience. Mentor and strategist for the team.",
		socialLinks: { twitter: "@kariv_ow", discord: "KariV#0003" },
		battletag: "KariV#2870",
		primaryRole: "support",
		secondaryRole: "damage",
		rank: "grandmaster",
		rankDivision: 4,
		participationIntent: "recruit_players",
		heroes: ["kiriko", "ana", "baptiste", "zenyatta", "mercy"],
	},

	crimzo: {
		username: "crimzo",
		displayName: "Crimzo",
		bio: "Main support for Dallas Fuel. Consistent lucio and ana player. Reliable shot-caller who keeps the team coordinated during intense fights.",
		socialLinks: { twitter: "@crimzo_ow" },
		battletag: "Crimzo#3157",
		primaryRole: "support",
		rank: "grandmaster",
		rankDivision: 5,
		participationIntent: "schedule_scrims",
		heroes: ["lucio", "ana", "mercy", "brigitte", "life-weaver"],
	},

	glister: {
		username: "glister",
		displayName: "Glister",
		bio: "Flex tank for Dallas Fuel. Rising Korean tank talent with excellent ramattra and zarya synergy plays.",
		socialLinks: { twitter: "@glister_ow" },
		battletag: "Glister#4201",
		primaryRole: "tank",
		secondaryRole: "support",
		rank: "grandmaster",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["zarya", "ramattra", "dva", "junker-queen", "sigma"],
	},

	// ── Dallas Fuel Challengers ────────────────────────────────────────────────

	coluge: {
		username: "coluge",
		displayName: "Coluge",
		bio: "Tank player for Dallas Fuel Challengers. Swedish mechanical talent with a high ceiling. Aiming to earn a spot on the main roster.",
		socialLinks: {},
		battletag: "Coluge#1647",
		primaryRole: "tank",
		rank: "master",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["sigma", "dva", "reinhardt", "orisa", "ramattra"],
	},

	mag: {
		username: "mag",
		displayName: "Mag",
		bio: "DPS player for Dallas Fuel Challengers. Italian mechanical sniper with a wicked widowmaker and hanzo.",
		socialLinks: { twitter: "@mag_ow" },
		battletag: "Mag#2341",
		primaryRole: "damage",
		rank: "master",
		rankDivision: 2,
		participationIntent: "schedule_scrims",
		heroes: ["widowmaker", "hanzo", "sojourn", "cassidy", "pharah"],
	},

	jmac: {
		username: "jmac",
		displayName: "JMAC",
		bio: "Support player for Dallas Fuel Challengers. Reliable ana and kiriko fundamentals with great communication.",
		socialLinks: {},
		battletag: "JMAC#5678",
		primaryRole: "support",
		rank: "master",
		rankDivision: 4,
		participationIntent: "schedule_scrims",
		heroes: ["ana", "kiriko", "zenyatta", "mercy", "baptiste"],
	},

	funnyastro: {
		username: "funnyastro",
		displayName: "FunnyAstro",
		bio: "Flex support for Dallas Fuel Challengers. Specialises in aggressive lucio play and hard-carry mercy. Brings high energy to every fight.",
		socialLinks: { twitter: "@funnyastro" },
		battletag: "FunnyAstro#9174",
		primaryRole: "support",
		secondaryRole: "damage",
		rank: "master",
		rankDivision: 5,
		participationIntent: "schedule_scrims",
		heroes: ["lucio", "mercy", "brigitte", "moira", "kiriko"],
	},

	pelican: {
		username: "pelican",
		displayName: "Pelican",
		bio: "DPS player for Dallas Fuel Challengers. Aggressive tracer and sombra specialist who thrives in fast-paced dives.",
		socialLinks: {},
		battletag: "Pelican#3309",
		primaryRole: "damage",
		rank: "master",
		rankDivision: 3,
		participationIntent: "schedule_scrims",
		heroes: ["tracer", "sombra", "genji", "echo", "venture"],
	},

	// ── Free agents ───────────────────────────────────────────────────────────

	birdring: {
		username: "birdring",
		displayName: "Birdring",
		bio: "Free agent hitscan DPS. OWL veteran and former London Spitfire star. Looking for a team to compete at the highest level again.",
		socialLinks: { twitter: "@birdring_ow" },
		battletag: "Birdring#3416",
		primaryRole: "damage",
		rank: "grandmaster",
		rankDivision: 3,
		participationIntent: "find_team",
		heroes: ["tracer", "sojourn", "widowmaker", "genji", "echo"],
	},

	colourhex: {
		username: "colourhex",
		displayName: "Colourhex",
		bio: "Free agent flex DPS. Canadian mechanical prodigy with top-500 credentials across multiple roles. Seeking a structured competitive environment.",
		socialLinks: { twitter: "@colourhex" },
		battletag: "Colourhex#1822",
		primaryRole: "damage",
		secondaryRole: "support",
		rank: "master",
		rankDivision: 1,
		participationIntent: "find_team",
		heroes: ["genji", "echo", "tracer", "sojourn", "pharah"],
	},

	speedily: {
		username: "speedily",
		displayName: "Speedily",
		bio: "Free agent main support. Experienced ana player looking for a serious team. Consistent performance across multiple seasons of Contenders.",
		socialLinks: { twitter: "@speedily_ow" },
		battletag: "Speedily#4455",
		primaryRole: "support",
		rank: "master",
		rankDivision: 2,
		participationIntent: "find_team",
		heroes: ["ana", "mercy", "lucio", "kiriko", "zenyatta"],
	},

	// ── Coaches ───────────────────────────────────────────────────────────────

	"shock-coach": {
		username: "shock-coach",
		displayName: "Jayne",
		bio: "Head coach for San Francisco Shock. Former competitive player turned veteran analyst with over a decade of coaching experience.",
		socialLinks: { twitter: "@jayne_ow" },
		battletag: "Jayne#1009",
		primaryRole: "support",
		rank: "diamond",
		rankDivision: 1,
		participationIntent: "recruit_players",
		heroes: ["ana", "lucio", "mercy"],
	},

	"fuel-coach": {
		username: "fuel-coach",
		displayName: "Gunba",
		bio: "Head coach for Dallas Fuel. Innovative strategist known for aggressive meta-calls and rapid team development. Multiple seasons coaching at the top level.",
		socialLinks: { twitter: "@gunba" },
		battletag: "Gunba#1123",
		primaryRole: "tank",
		rank: "diamond",
		rankDivision: 2,
		participationIntent: "recruit_players",
		heroes: ["dva", "sigma", "reinhardt"],
	},

	// ── Demo admin ────────────────────────────────────────────────────────────

	demo: {
		username: "demo",
		displayName: "Demo Admin",
		bio: "Platform demo account with access to all organizations and teams. Use this account to explore org-level management features.",
		socialLinks: {},
		battletag: "Demo#0001",
		primaryRole: "damage",
		rank: "master",
		rankDivision: 3,
		participationIntent: "just_browsing",
		heroes: ["tracer", "genji", "sojourn"],
	},
};

// ─── Org / team structure ────────────────────────────────────────────────────

const ORGS = {
	sfShock: {
		name: "San Francisco Shock",
		slug: "sf-shock",
		description:
			"Two-time Overwatch League Grand Champions. A legacy of excellence from the Bay Area.",
		website: "https://www.sanfranciscoshock.com",
		twitter: "@SFShock",
		discord: "discord.gg/sfshock",
		ownerUsername: "smurf",
	},
	dallasFuel: {
		name: "Dallas Fuel",
		slug: "dallas-fuel",
		description:
			"Dallas Fuel — competing at the highest level of Overwatch esports since 2016. Home of the Fuel.",
		website: "https://www.dallasfuel.com",
		twitter: "@DallasFuel",
		discord: "discord.gg/dallasfuel",
		ownerUsername: "hanbin",
	},
};

type RosterEntry = {
	username: string;
	permissionRole: "admin" | "member";
	memberType: "player" | "staff";
	roleInTeam?: "tank" | "damage" | "support";
	staffRole?: "coach" | "analyst" | "manager" | "staff";
	status: "active" | "benched" | "trial";
};

const TEAMS = [
	{
		org: "sfShock" as const,
		name: "SF Shock",
		tag: "SHCK",
		description: "Main competitive roster — contenders for the championship.",
		rating: 2150,
		ratingDeviation: 150,
		matchesPlayed: 42,
		isRecruiting: false,
		roster: [
			{
				username: "smurf",
				permissionRole: "admin",
				memberType: "player",
				roleInTeam: "tank",
				status: "active",
			},
			{
				username: "viol2t",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "tank",
				status: "active",
			},
			{
				username: "proper",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "damage",
				status: "active",
			},
			{
				username: "krakinlakin",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "damage",
				status: "active",
			},
			{
				username: "moth",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "shqote",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "shock-coach",
				permissionRole: "admin",
				memberType: "staff",
				staffRole: "coach",
				status: "active",
			},
		] as RosterEntry[],
		updates: [
			{
				title: "Season kickoff — Shock are back",
				body: "The San Francisco Shock are ready to defend the championship. After an intense offseason bootcamp in Seoul, the roster is tighter than ever. We're going into this season with the same goal as always: win it all.\n\nSpecial thanks to our sponsors and the entire Bay Area community for the incredible support. Let's get it done.",
				visibility: "public" as const,
			},
			{
				title: "Bootcamp recap — Week 3",
				body: "Three weeks into our pre-season bootcamp and the synergy is really clicking. Highlight of the week was running extended BO5 practice sets with two Korean challenger teams. Results are promising.\n\nCoach Jayne has dialled in our map pool and we're looking forward to the upcoming scrim block. Schedule will be posted in the roster channel.",
				visibility: "workspace" as const,
			},
		],
		listings: [
			{
				type: "lfp" as const,
				title: "Shock are looking for a backup off-tank",
				description:
					"SF Shock Academy and the main roster are looking to add a high-level off-tank to the extended squad. Ideal candidate: GM+ rank, comfortable on sigma, zarya, and dva. Must be available weekday evenings (18:00-22:00 UTC).\n\nApplicants will be trialled in scrims before any offer is extended.",
				memberType: "player" as const,
				rolesNeeded: ["tank"],
				minRank: "grandmaster",
			},
		],
	},
	{
		org: "sfShock" as const,
		name: "SF Shock Academy",
		tag: "SFS2",
		description: "Development roster. The future of the Shock, being forged today.",
		rating: 1760,
		ratingDeviation: 200,
		matchesPlayed: 18,
		isRecruiting: true,
		roster: [
			{
				username: "aznrite",
				permissionRole: "admin",
				memberType: "player",
				roleInTeam: "damage",
				status: "active",
			},
			{
				username: "kalios",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "tank",
				status: "active",
			},
			{
				username: "alarm",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "leyton",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "hadi",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "tank",
				status: "active",
			},
		] as RosterEntry[],
		updates: [
			{
				title: "Academy roster — introducing the new squad",
				body: "We're thrilled to unveil the SF Shock Academy lineup for this season. These players represent the next generation of Shock talent and have shown incredible dedication during tryouts.\n\nExpect to see them competing regularly and pushing for main roster spots.",
				visibility: "public" as const,
			},
		],
		listings: [
			{
				type: "lfp" as const,
				title: "Academy looking for a main support",
				description:
					"SF Shock Academy is actively recruiting a main support player. Looking for someone Masters 3+ with strong ana and kiriko mechanics, good comms, and a willingness to develop within a structured environment.\n\nThis is a genuine development opportunity — standout performers will be considered for main roster promotion.",
				memberType: "player" as const,
				rolesNeeded: ["support"],
				minRank: "master",
				maxRank: "grandmaster",
			},
		],
	},
	{
		org: "dallasFuel" as const,
		name: "Dallas Fuel",
		tag: "DAL",
		description: "The pride of Dallas. Competing at the highest level since 2016.",
		rating: 2050,
		ratingDeviation: 160,
		matchesPlayed: 38,
		isRecruiting: false,
		roster: [
			{
				username: "hanbin",
				permissionRole: "admin",
				memberType: "player",
				roleInTeam: "tank",
				status: "active",
			},
			{
				username: "fielder",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "damage",
				status: "active",
			},
			{
				username: "doha",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "damage",
				status: "active",
			},
			{
				username: "kariv",
				permissionRole: "admin",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "crimzo",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "glister",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "tank",
				status: "active",
			},
			{
				username: "fuel-coach",
				permissionRole: "admin",
				memberType: "staff",
				staffRole: "coach",
				status: "active",
			},
		] as RosterEntry[],
		updates: [
			{
				title: "Dallas Fuel roster announcement",
				body: "Dallas Fuel is proud to announce its competitive roster for the upcoming season. After extensive trials and negotiations, we believe we've built the most cohesive and dangerous Fuel lineup in years.\n\nHanbin leads the charge as team captain, backed by the veteran experience of KariV and the explosive mechanics of Doha and Fielder. We're coming for the top.",
				visibility: "public" as const,
			},
			{
				title: "Scrim block schedule — this week",
				body: "This week's scrim schedule:\n\n**Monday** — 18:00 UTC vs. NYE\n**Wednesday** — 19:00 UTC vs. LAG (BO5)\n**Thursday** — 18:30 UTC — internal review and VOD session\n**Friday** — 18:00 UTC vs. ATL\n\nAll players to be online 15 min before start. Map pool: focus on control and hybrid this week. Coach Gunba will share the strat doc before Monday.",
				visibility: "workspace" as const,
			},
		],
		listings: [],
	},
	{
		org: "dallasFuel" as const,
		name: "Dallas Fuel Challengers",
		tag: "DALC",
		description: "Next-generation talent under the Fuel banner.",
		rating: 1680,
		ratingDeviation: 210,
		matchesPlayed: 14,
		isRecruiting: true,
		roster: [
			{
				username: "coluge",
				permissionRole: "admin",
				memberType: "player",
				roleInTeam: "tank",
				status: "active",
			},
			{
				username: "mag",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "damage",
				status: "active",
			},
			{
				username: "jmac",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "funnyastro",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "support",
				status: "active",
			},
			{
				username: "pelican",
				permissionRole: "member",
				memberType: "player",
				roleInTeam: "damage",
				status: "active",
			},
		] as RosterEntry[],
		updates: [
			{
				title: "Challengers — first scrim results",
				body: "Solid first scrim block for the Challengers squad. We went 3-2 across the week including a strong BO5 win on control maps. Coluge's sigma play was a consistent highlight.\n\nStill building synergy but the potential is clearly there. Next week we push for a clean sweep.",
				visibility: "workspace" as const,
			},
		],
		listings: [
			{
				type: "lfp" as const,
				title: "Challengers looking for a flex DPS",
				description:
					"Dallas Fuel Challengers are looking for a flex DPS player to complete the roster. We need someone who can play both hitscan (sojourn/cassidy) and projectile (genji/echo). Masters 2+ required.\n\nGood team culture is a priority — we're building for the long term under the Fuel banner.",
				memberType: "player" as const,
				rolesNeeded: ["damage"],
				minRank: "master",
				maxRank: "grandmaster",
			},
		],
	},
];

// Free-agent recruiting listings (player-owned LFT posts)
const FREE_AGENT_LISTINGS = [
	{
		username: "birdring",
		type: "lft" as const,
		title: "GM hitscan DPS — available now",
		description:
			"OWL veteran and hitscan specialist looking for a serious team. Available for full-time practice schedules. Strong tracer, sojourn, and widowmaker. Refs available from previous orgs.\n\nLooking for: GM-level main roster or strong academy position. EU/NA both considered.",
		rolesNeeded: ["damage"],
		minRank: "grandmaster",
	},
	{
		username: "colourhex",
		type: "lft" as const,
		title: "Flex DPS — Top 500, multiple roles",
		description:
			"Top 500 flex DPS looking for a structured team environment to grow. Can fill genji, echo, tracer, and sojourn. Consistently high placements in both NA and EU ladders. Available evenings and full weekends.\n\nDM me on Discord: Colourhex#1822",
		rolesNeeded: ["damage"],
		minRank: "master",
	},
	{
		username: "speedily",
		type: "lft" as const,
		title: "Main support — Contenders experienced",
		description:
			"Experienced main support player looking for a competitive team. Multiple seasons of Contenders experience across three orgs. Strong on ana and mercy. Good shotcalling, team-first mentality.\n\nPreferably looking for a team with a set schedule and coaching staff.",
		rolesNeeded: ["support"],
		minRank: "master",
	},
];

// ─── Availability template ───────────────────────────────────────────────────

function weekdaySlots(userId: string, teamId: string) {
	// Mon-Thu evenings 18:00-22:00 UTC
	return [1, 2, 3, 4].map((day) => ({
		userId,
		teamId,
		dayOfWeek: day,
		startTime: "18:00",
		endTime: "22:00",
		timezone: "UTC",
		label: "Weekday evening",
	}));
}

function weekendSlots(userId: string, teamId: string) {
	// Sat-Sun 13:00-22:00 UTC
	return [6, 0].map((day) => ({
		userId,
		teamId,
		dayOfWeek: day,
		startTime: "13:00",
		endTime: "22:00",
		timezone: "UTC",
		label: "Weekend",
	}));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findOrCreateTeam(
	orgId: string,
	name: string,
	tag: string,
	values: Omit<typeof teamTable.$inferInsert, "id" | "organizationId" | "name" | "tag">
): Promise<string> {
	const existing = await db
		.select({ id: teamTable.id })
		.from(teamTable)
		.where(and(eq(teamTable.organizationId, orgId), eq(teamTable.tag, tag)))
		.limit(1);
	if (existing[0]) return existing[0].id;

	const [row] = await db
		.insert(teamTable)
		.values({ organizationId: orgId, name, tag, ...values })
		.returning({ id: teamTable.id });
	if (!row) throw new Error(`Failed to create team ${tag}`);
	return row.id;
}

async function upsertListing(
	userId: string,
	teamId: string | null,
	orgId: string | null,
	listing: {
		type: "lfp" | "lft" | "lfr" | "lfs";
		title: string;
		description: string;
		memberType: "player" | "staff";
		rolesNeeded: string[];
		minRank?: string;
		maxRank?: string;
	}
): Promise<void> {
	// Skip if a listing with the same title already exists for this user
	const existing = await db
		.select({ id: recruitmentListingTable.id })
		.from(recruitmentListingTable)
		.where(
			and(
				eq(recruitmentListingTable.userId, userId),
				eq(recruitmentListingTable.title, listing.title)
			)
		)
		.limit(1);
	if (existing[0]) return;

	await db.insert(recruitmentListingTable).values({
		type: listing.type,
		ownerType: teamId ? "team" : "player",
		userId,
		organizationId: orgId ?? undefined,
		teamId: teamId ?? undefined,
		status: "open",
		title: listing.title,
		description: listing.description,
		memberType: listing.memberType,
		rolesNeeded: listing.rolesNeeded,
		minRank: (listing.minRank as "grandmaster" | "master" | undefined) ?? undefined,
		maxRank: (listing.maxRank as "grandmaster" | "master" | undefined) ?? undefined,
		expiresAt: new Date(Date.now() + 30 * 86_400_000),
	});
}

async function upsertUpdate(
	authorUserId: string,
	teamId: string | null,
	orgId: string | null,
	post: { title: string; body: string; visibility: "public" | "workspace" }
): Promise<void> {
	const existing = await db
		.select({ id: updatePostTable.id })
		.from(updatePostTable)
		.where(
			and(
				teamId
					? eq(updatePostTable.teamId, teamId)
					: eq(updatePostTable.organizationId, orgId ?? ""),
				eq(updatePostTable.title, post.title)
			)
		)
		.limit(1);
	if (existing[0]) return;

	await db.insert(updatePostTable).values({
		scopeType: teamId ? "team" : "organization",
		visibility: post.visibility,
		authorUserId,
		organizationId: orgId ?? undefined,
		teamId: teamId ?? undefined,
		title: post.title,
		body: post.body,
	});
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const dbUrl = process.env.DATABASE_URL ?? "";
	if (
		!dbUrl.includes("localhost") &&
		!dbUrl.includes("127.0.0.1") &&
		!dbUrl.includes("host.docker.internal")
	) {
		console.error("❌ DATABASE_URL does not appear to point to a local database. Aborting.");
		process.exit(1);
	}

	console.log("🌱  Demo seed starting…\n");

	// ── 1. Hash the shared demo password ──────────────────────────────────────
	console.log("  Hashing password…");
	const passwordHash = await hashPassword(DEMO_PASSWORD);

	// ── 2. Upsert users ───────────────────────────────────────────────────────
	console.log("  Upserting users…");
	const userIds: Record<string, string> = {};

	for (const [key, p] of Object.entries(PLAYERS)) {
		const email = `${p.username}@${EMAIL_DOMAIN}`;

		// Free the username if held by a different account
		await db
			.update(userTable)
			.set({ username: `${p.username}-displaced-${Date.now()}` })
			.where(and(eq(userTable.username, p.username), ne(userTable.email, email)));

		const [row] = await db
			.insert(userTable)
			.values({
				email,
				username: p.username,
				displayName: p.displayName,
				passwordHash,
				emailVerified: true,
				isBanned: false,
				requiresReverification: false,
				bio: p.bio,
				socialLinks: p.socialLinks,
			})
			.onConflictDoUpdate({
				target: userTable.email,
				set: {
					username: p.username,
					displayName: p.displayName,
					passwordHash,
					bio: p.bio,
					socialLinks: p.socialLinks,
					emailVerified: true,
					isBanned: false,
					requiresReverification: false,
				},
			})
			.returning({ id: userTable.id });

		if (!row) throw new Error(`Failed to upsert user ${key}`);
		userIds[key] = row.id;
	}
	console.log(`    ✓ ${Object.keys(PLAYERS).length} users`);

	// ── 3. Upsert player profiles ─────────────────────────────────────────────
	console.log("  Upserting player profiles…");
	for (const [key, p] of Object.entries(PLAYERS)) {
		await db
			.insert(playerProfileTable)
			.values({
				userId: userIds[key],
				battletag: p.battletag,
				primaryRole: p.primaryRole,
				secondaryRole: p.secondaryRole ?? null,
				rank: p.rank,
				rankDivision: p.rankDivision,
				participationIntent: p.participationIntent,
				availabilityIntent: "weekdays",
				profileVisibility: "public",
				recruitingDiscoverability: true,
			})
			.onConflictDoUpdate({
				target: playerProfileTable.userId,
				set: {
					battletag: p.battletag,
					primaryRole: p.primaryRole,
					secondaryRole: p.secondaryRole ?? null,
					rank: p.rank,
					rankDivision: p.rankDivision,
					participationIntent: p.participationIntent,
				},
			});
	}
	console.log(`    ✓ ${Object.keys(PLAYERS).length} player profiles`);

	// ── 4. Seed hero pools ────────────────────────────────────────────────────
	console.log("  Seeding hero pools…");
	for (const [key, p] of Object.entries(PLAYERS)) {
		const userId = userIds[key];
		// Clear existing hero pool and reinsert
		// (using onConflictDoNothing on PK for idempotency)
		await db
			.insert(playerHeroTable)
			.values(p.heroes.map((heroId) => ({ userId, heroId })))
			.onConflictDoNothing();
	}
	console.log(`    ✓ hero pools seeded`);

	// ── 5. Upsert organizations ───────────────────────────────────────────────
	console.log("  Upserting organizations…");
	const orgIds: Record<string, string> = {};

	for (const [key, org] of Object.entries(ORGS)) {
		const ownerId = userIds[org.ownerUsername];
		if (!ownerId) throw new Error(`Owner user '${org.ownerUsername}' not found`);

		const [row] = await db
			.insert(organizationTable)
			.values({
				name: org.name,
				slug: org.slug,
				description: org.description,
				website: org.website,
				twitter: org.twitter,
				discord: org.discord,
				ownerId,
				isPublic: true,
				lifecycleStatus: "active",
			})
			.onConflictDoUpdate({
				target: organizationTable.slug,
				set: {
					name: org.name,
					description: org.description,
					website: org.website,
					twitter: org.twitter,
					discord: org.discord,
					ownerId,
				},
			})
			.returning({ id: organizationTable.id });

		if (!row) throw new Error(`Failed to upsert org ${key}`);
		orgIds[key] = row.id;
	}
	console.log(`    ✓ ${Object.keys(ORGS).length} organizations`);

	// ── 6. Seed org members ───────────────────────────────────────────────────
	console.log("  Seeding org memberships…");

	// Owner memberships
	await db
		.insert(organizationMemberTable)
		.values([
			{
				organizationId: orgIds.sfShock,
				userId: userIds.smurf,
				role: "owner",
				memberType: "player",
			},
			{
				organizationId: orgIds.dallasFuel,
				userId: userIds.hanbin,
				role: "owner",
				memberType: "player",
			},
		])
		.onConflictDoUpdate({
			target: [organizationMemberTable.organizationId, organizationMemberTable.userId],
			set: { role: "owner" },
		});

	// SFS members (players + coach)
	const sfsMembers = [
		"viol2t",
		"proper",
		"krakinlakin",
		"moth",
		"shqote",
		"aznrite",
		"kalios",
		"alarm",
		"leyton",
		"hadi",
		"shock-coach",
	];
	for (const username of sfsMembers) {
		await db
			.insert(organizationMemberTable)
			.values({
				organizationId: orgIds.sfShock,
				userId: userIds[username],
				role: "member",
				memberType: username === "shock-coach" ? "staff" : "player",
				staffRole: username === "shock-coach" ? "coach" : undefined,
			})
			.onConflictDoUpdate({
				target: [organizationMemberTable.organizationId, organizationMemberTable.userId],
				set: { role: "member" },
			});
	}

	// DAL members (players + coach)
	const dalMembers = [
		"fielder",
		"doha",
		"kariv",
		"crimzo",
		"glister",
		"coluge",
		"mag",
		"jmac",
		"funnyastro",
		"pelican",
		"fuel-coach",
	];
	for (const username of dalMembers) {
		await db
			.insert(organizationMemberTable)
			.values({
				organizationId: orgIds.dallasFuel,
				userId: userIds[username],
				role: "member",
				memberType: username === "fuel-coach" ? "staff" : "player",
				staffRole: username === "fuel-coach" ? "coach" : undefined,
			})
			.onConflictDoUpdate({
				target: [organizationMemberTable.organizationId, organizationMemberTable.userId],
				set: { role: "member" },
			});
	}

	// Demo admin — member of both orgs (admin role)
	for (const orgId of Object.values(orgIds)) {
		await db
			.insert(organizationMemberTable)
			.values({ organizationId: orgId, userId: userIds.demo, role: "admin", memberType: "player" })
			.onConflictDoUpdate({
				target: [organizationMemberTable.organizationId, organizationMemberTable.userId],
				set: { role: "admin" },
			});
	}

	console.log(`    ✓ org memberships seeded`);

	// ── 7. Create teams ───────────────────────────────────────────────────────
	console.log("  Creating teams…");
	const teamIds: string[] = [];
	const tagToTeamId: Record<string, string> = {}; // tag-lowercase → teamId

	for (const team of TEAMS) {
		const orgId = orgIds[team.org];
		const teamId = await findOrCreateTeam(orgId, team.name, team.tag, {
			description: team.description,
			rating: team.rating,
			ratingDeviation: team.ratingDeviation,
			matchesPlayed: team.matchesPlayed,
			isRecruiting: team.isRecruiting,
			lifecycleStatus: "active",
			isPublic: true,
		});
		teamIds.push(teamId);
		tagToTeamId[team.tag.toLowerCase()] = teamId;
		console.log(`    ✓ [${team.tag}] ${team.name} (id: ${teamId.slice(0, 8)}…)`);

		// ── 8. Seed team rosters ─────────────────────────────────────────────
		for (const entry of team.roster) {
			const userId = userIds[entry.username];
			if (!userId) {
				console.warn(`    ⚠ Unknown username in roster: ${entry.username}`);
				continue;
			}
			await db
				.insert(teamRosterTable)
				.values({
					teamId,
					userId,
					permissionRole: entry.permissionRole,
					memberType: entry.memberType,
					roleInTeam: entry.roleInTeam ?? null,
					staffRole: entry.staffRole ?? null,
					status: entry.status,
				})
				.onConflictDoUpdate({
					target: [teamRosterTable.teamId, teamRosterTable.userId],
					set: {
						permissionRole: entry.permissionRole,
						memberType: entry.memberType,
						roleInTeam: entry.roleInTeam ?? null,
						staffRole: entry.staffRole ?? null,
						status: entry.status,
					},
				});
		}

		// ── 9. Seed availability ──────────────────────────────────────────────
		for (const entry of team.roster) {
			if (entry.memberType !== "player") continue;
			const userId = userIds[entry.username];
			if (!userId) continue;

			// Remove stale availability for this user+team, then insert fresh
			await db
				.delete(availabilityTable)
				.where(and(eq(availabilityTable.userId, userId), eq(availabilityTable.teamId, teamId)));

			const slots = [...weekdaySlots(userId, teamId), ...weekendSlots(userId, teamId)];
			await db.insert(availabilityTable).values(slots);
		}

		// ── 10. Seed update posts ─────────────────────────────────────────────
		const adminUser = team.roster.find(
			(r) => r.permissionRole === "admin" && r.memberType === "player"
		);
		const authorId = adminUser ? userIds[adminUser.username] : userIds.demo;
		const orgId2 = orgIds[team.org];

		for (const post of team.updates) {
			await upsertUpdate(authorId, teamId, orgId2, post);
		}

		// ── 11. Seed recruiting listings ──────────────────────────────────────
		const ownerUser = team.roster.find(
			(r) => r.permissionRole === "admin" && r.memberType === "player"
		);
		const ownerId = ownerUser ? userIds[ownerUser.username] : userIds.demo;

		for (const listing of team.listings) {
			await upsertListing(ownerId, teamId, orgId2, {
				...listing,
				memberType: listing.memberType,
			});
		}
	}

	// ── 12. Free-agent LFT listings ───────────────────────────────────────────
	console.log("  Seeding free-agent LFT listings…");
	for (const fa of FREE_AGENT_LISTINGS) {
		const userId = userIds[fa.username];
		if (!userId) continue;
		await upsertListing(userId, null, null, {
			type: fa.type,
			title: fa.title,
			description: fa.description,
			memberType: "player",
			rolesNeeded: fa.rolesNeeded,
			minRank: fa.minRank,
		});
	}
	console.log(`    ✓ ${FREE_AGENT_LISTINGS.length} LFT listings`);

	// ── 13. Add demo user to both teams (read-only view of everything) ─────────
	console.log("  Adding demo admin to team rosters…");
	for (const teamId of teamIds) {
		await db
			.insert(teamRosterTable)
			.values({
				teamId,
				userId: userIds.demo,
				permissionRole: "admin",
				memberType: "player",
				status: "inactive",
			})
			.onConflictDoUpdate({
				target: [teamRosterTable.teamId, teamRosterTable.userId],
				set: { permissionRole: "admin" },
			});
	}

	// ── 14. Upload demo images ────────────────────────────────────────────────
	console.log("  Uploading demo images (skips gracefully if directories are empty)…");
	const publicUrl = (process.env.S3_PUBLIC_URL ?? "http://localhost:9000").replace(/\/$/, "");

	// Build a slug → orgId lookup from the ORGS definition.
	const slugToOrgId: Record<string, string> = {};
	for (const [key, orgDef] of Object.entries(ORGS)) {
		slugToOrgId[orgDef.slug] = orgIds[key];
	}

	// ── Players ──────────────────────────────────────────────────────────────
	const playerResult = await uploadEntityImages({
		dir: join(DEMO_IMAGES_ROOT, "players"),
		bucket: "demo-players",
		publicUrl,
		entities: Object.entries(userIds).map(([username, userId]) => ({
			key: username,
			setAvatar: (url) =>
				db.update(userTable).set({ avatarUrl: url }).where(eq(userTable.id, userId)),
			setBanner: (url) =>
				db.update(userTable).set({ bannerUrl: url }).where(eq(userTable.id, userId)),
		})),
	});
	console.log(`    ✓ players: ${playerResult.uploaded} image(s) uploaded`);
	if (playerResult.skipped.length)
		console.log(`    ~ unmatched: ${playerResult.skipped.join(", ")}`);

	// ── Teams ────────────────────────────────────────────────────────────────
	const teamResult = await uploadEntityImages({
		dir: join(DEMO_IMAGES_ROOT, "teams"),
		bucket: "demo-teams",
		publicUrl,
		entities: Object.entries(tagToTeamId).map(([tag, teamId]) => ({
			key: tag, // already lowercase
			setAvatar: (url) =>
				db.update(teamTable).set({ avatarUrl: url }).where(eq(teamTable.id, teamId)),
			setBanner: (url) =>
				db.update(teamTable).set({ bannerUrl: url }).where(eq(teamTable.id, teamId)),
		})),
	});
	console.log(`    ✓ teams:   ${teamResult.uploaded} image(s) uploaded`);
	if (teamResult.skipped.length) console.log(`    ~ unmatched: ${teamResult.skipped.join(", ")}`);

	// ── Orgs ─────────────────────────────────────────────────────────────────
	const orgResult = await uploadEntityImages({
		dir: join(DEMO_IMAGES_ROOT, "orgs"),
		bucket: "demo-orgs",
		publicUrl,
		entities: Object.entries(slugToOrgId).map(([slug, orgId]) => ({
			key: slug,
			setAvatar: (url) =>
				db.update(organizationTable).set({ avatarUrl: url }).where(eq(organizationTable.id, orgId)),
			setBanner: (url) =>
				db.update(organizationTable).set({ bannerUrl: url }).where(eq(organizationTable.id, orgId)),
		})),
	});
	console.log(`    ✓ orgs:    ${orgResult.uploaded} image(s) uploaded`);
	if (orgResult.skipped.length) console.log(`    ~ unmatched: ${orgResult.skipped.join(", ")}`);

	// ── Summary ───────────────────────────────────────────────────────────────
	console.log("\n✅  Demo seed complete!\n");
	console.log("  Accounts (password: Scrimflow1!):\n");

	const accountsByOrg: Record<string, string[]> = {
		"SF Shock Main (SHCK)": ["smurf", "viol2t", "proper", "krakinlakin", "moth", "shqote"],
		"SF Shock Academy (SFS2)": ["aznrite", "kalios", "alarm", "leyton", "hadi"],
		"Dallas Fuel Main (DAL)": ["hanbin", "fielder", "doha", "kariv", "crimzo", "glister"],
		"Dallas Fuel Challengers (DALC)": ["coluge", "mag", "jmac", "funnyastro", "pelican"],
		Coaches: ["shock-coach (Jayne / SFS)", "fuel-coach (Gunba / DAL)"],
		"Free agents": ["birdring", "colourhex", "speedily"],
		"Demo admin (both orgs)": ["demo"],
	};

	for (const [section, users] of Object.entries(accountsByOrg)) {
		console.log(`  ${section}:`);
		for (const u of users) {
			const username = u.split(" ")[0];
			const email = `${username}@${EMAIL_DOMAIN}`;
			console.log(`    ${email.padEnd(36)}  pass: Scrimflow1!`);
		}
		console.log();
	}

	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
