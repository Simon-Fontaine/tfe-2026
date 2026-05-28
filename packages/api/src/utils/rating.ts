import { eq } from "drizzle-orm";

import type { db } from "@/db";
import { scrimTable, teamRatingEventTable, teamTable } from "@/db/schema";

const GLICKO_Q = Math.log(10) / 400;
const MIN_RATING = 100;
const MIN_RATING_DEVIATION = 60;
const MAX_RATING_DEVIATION = 350;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type RatedTeamSnapshot = {
	id: string;
	rating: number;
	ratingDeviation: number;
	matchesPlayed: number;
};

type TeamRatingUpdate = {
	teamId: string;
	ratingBefore: number;
	ratingAfter: number;
	ratingDelta: number;
	ratingDeviationBefore: number;
	ratingDeviationAfter: number;
	matchesPlayedAfter: number;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function normalizeRatingDeviation(value: number) {
	return clamp(value, MIN_RATING_DEVIATION, MAX_RATING_DEVIATION);
}

function resolveSeriesScore(teamMapScore: number, opponentMapScore: number) {
	if (teamMapScore > opponentMapScore) return 1;
	if (teamMapScore < opponentMapScore) return 0;
	return 0.5;
}

function g(opponentRatingDeviation: number) {
	const normalizedDeviation = normalizeRatingDeviation(opponentRatingDeviation);
	return (
		1 /
		Math.sqrt(
			1 +
				(3 * GLICKO_Q * GLICKO_Q * normalizedDeviation * normalizedDeviation) / (Math.PI * Math.PI)
		)
	);
}

function expectedScore(
	teamRating: number,
	opponentRating: number,
	opponentRatingDeviation: number
) {
	return 1 / (1 + 10 ** ((-g(opponentRatingDeviation) * (teamRating - opponentRating)) / 400));
}

function calculateMatchUpdate(
	team: RatedTeamSnapshot,
	opponent: RatedTeamSnapshot,
	score: number
): TeamRatingUpdate {
	const ratingDeviationBefore = normalizeRatingDeviation(team.ratingDeviation);
	const gOpponent = g(opponent.ratingDeviation);
	const expected = expectedScore(team.rating, opponent.rating, opponent.ratingDeviation);
	const variance = 1 / (GLICKO_Q * GLICKO_Q * gOpponent * gOpponent * expected * (1 - expected));
	const precision = 1 / (ratingDeviationBefore * ratingDeviationBefore) + 1 / variance;
	const ratingAfter = Math.round(
		clamp(
			team.rating + (GLICKO_Q / precision) * gOpponent * (score - expected),
			MIN_RATING,
			Number.MAX_SAFE_INTEGER
		)
	);
	const ratingDeviationAfter = Math.round(
		clamp(Math.sqrt(1 / precision), MIN_RATING_DEVIATION, MAX_RATING_DEVIATION)
	);

	return {
		teamId: team.id,
		ratingBefore: team.rating,
		ratingAfter,
		ratingDelta: ratingAfter - team.rating,
		ratingDeviationBefore,
		ratingDeviationAfter,
		matchesPlayedAfter: team.matchesPlayed + 1,
	};
}

export async function applyCompletedScrimRating(tx: DbTransaction, scrimId: string) {
	const scrim = await tx.query.scrimTable.findFirst({
		where: eq(scrimTable.id, scrimId),
		columns: {
			id: true,
			homeTeamId: true,
			awayTeamId: true,
			homeMapScore: true,
			awayMapScore: true,
		},
	});

	if (!scrim || !scrim.awayTeamId) {
		throw new Error("Completed scrim ratings require both teams to exist.");
	}

	const existingEvents = await tx.query.teamRatingEventTable.findMany({
		where: eq(teamRatingEventTable.scrimId, scrimId),
		columns: { id: true },
	});

	if (existingEvents.length > 0) {
		if (existingEvents.length !== 2) {
			throw new Error("The scrim rating history is in an inconsistent state.");
		}

		await tx.update(scrimTable).set({ status: "completed" }).where(eq(scrimTable.id, scrimId));

		return { applied: false as const };
	}

	const [homeTeam, awayTeam] = await Promise.all([
		tx.query.teamTable.findFirst({
			where: eq(teamTable.id, scrim.homeTeamId),
			columns: {
				id: true,
				rating: true,
				ratingDeviation: true,
				matchesPlayed: true,
			},
		}),
		tx.query.teamTable.findFirst({
			where: eq(teamTable.id, scrim.awayTeamId),
			columns: {
				id: true,
				rating: true,
				ratingDeviation: true,
				matchesPlayed: true,
			},
		}),
	]);

	if (!homeTeam || !awayTeam) {
		throw new Error("Both teams must exist before a scrim rating can be applied.");
	}

	const homeUpdate = calculateMatchUpdate(
		homeTeam,
		awayTeam,
		resolveSeriesScore(scrim.homeMapScore, scrim.awayMapScore)
	);
	const awayUpdate = calculateMatchUpdate(
		awayTeam,
		homeTeam,
		resolveSeriesScore(scrim.awayMapScore, scrim.homeMapScore)
	);

	await tx.insert(teamRatingEventTable).values([
		{
			teamId: homeUpdate.teamId,
			scrimId,
			ratingBefore: homeUpdate.ratingBefore,
			ratingAfter: homeUpdate.ratingAfter,
			ratingDelta: homeUpdate.ratingDelta,
			ratingDeviationBefore: homeUpdate.ratingDeviationBefore,
			ratingDeviationAfter: homeUpdate.ratingDeviationAfter,
			algorithmVersion: "glicko-1.0",
		},
		{
			teamId: awayUpdate.teamId,
			scrimId,
			ratingBefore: awayUpdate.ratingBefore,
			ratingAfter: awayUpdate.ratingAfter,
			ratingDelta: awayUpdate.ratingDelta,
			ratingDeviationBefore: awayUpdate.ratingDeviationBefore,
			ratingDeviationAfter: awayUpdate.ratingDeviationAfter,
			algorithmVersion: "glicko-1.0",
		},
	]);

	await Promise.all([
		tx
			.update(teamTable)
			.set({
				rating: homeUpdate.ratingAfter,
				ratingDeviation: homeUpdate.ratingDeviationAfter,
				matchesPlayed: homeUpdate.matchesPlayedAfter,
			})
			.where(eq(teamTable.id, homeTeam.id)),
		tx
			.update(teamTable)
			.set({
				rating: awayUpdate.ratingAfter,
				ratingDeviation: awayUpdate.ratingDeviationAfter,
				matchesPlayed: awayUpdate.matchesPlayedAfter,
			})
			.where(eq(teamTable.id, awayTeam.id)),
		tx.update(scrimTable).set({ status: "completed" }).where(eq(scrimTable.id, scrimId)),
	]);

	return {
		applied: true as const,
		homeUpdate,
		awayUpdate,
	};
}
