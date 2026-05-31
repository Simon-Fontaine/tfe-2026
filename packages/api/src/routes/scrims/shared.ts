import type { ScrimSummary } from "@scrimflow/shared";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	ocrJobTable,
	scrimMapTable,
	scrimNegotiationRevisionTable,
	scrimPlayerStatTable,
	scrimResultRevisionTable,
	scrimTable,
	teamRatingEventTable,
} from "@/db/schema";

export class ScrimWorkflowError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = "ScrimWorkflowError";
	}
}

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findScrimWithRelations(scrimId: string) {
	return db.query.scrimTable.findFirst({
		where: eq(scrimTable.id, scrimId),
		with: {
			homeTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
					isArchived: true,
				},
				with: {
					organization: {
						columns: { name: true },
					},
				},
			},
			awayTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
					isArchived: true,
				},
				with: {
					organization: {
						columns: { name: true },
					},
				},
			},
			createdBy: {
				columns: {
					id: true,
					displayName: true,
				},
			},
			disputeResolvedBy: {
				columns: {
					id: true,
					displayName: true,
				},
			},
			disputeRespondedBy: {
				columns: {
					displayName: true,
				},
			},
			confirmations: {
				columns: {
					id: true,
					teamId: true,
					status: true,
					disputeReason: true,
					confirmedByUserId: true,
					confirmedAt: true,
					updatedAt: true,
				},
				with: {
					team: {
						columns: {
							id: true,
							name: true,
							tag: true,
						},
					},
					confirmedBy: {
						columns: {
							id: true,
							displayName: true,
						},
					},
				},
			},
			ratingEvents: {
				columns: {
					id: true,
					teamId: true,
					ratingBefore: true,
					ratingAfter: true,
					ratingDelta: true,
					ratingDeviationBefore: true,
					ratingDeviationAfter: true,
					algorithmVersion: true,
					createdAt: true,
				},
				with: {
					team: {
						columns: {
							id: true,
							name: true,
							tag: true,
						},
					},
				},
				orderBy: [asc(teamRatingEventTable.createdAt)],
			},
			resultRevisions: {
				columns: {
					id: true,
					revisionNumber: true,
					reportingTeamId: true,
					submittedByUserId: true,
					sourceOcrJobId: true,
					homeMapScore: true,
					awayMapScore: true,
					startedAt: true,
					endedAt: true,
					snapshot: true,
					changeSummary: true,
					createdAt: true,
				},
				with: {
					reportingTeam: {
						columns: {
							id: true,
							name: true,
							tag: true,
						},
					},
					submittedBy: {
						columns: {
							id: true,
							displayName: true,
						},
					},
				},
				orderBy: [desc(scrimResultRevisionTable.revisionNumber)],
			},
			negotiationRevisions: {
				columns: {
					id: true,
					action: true,
					actorUserId: true,
					actorTeamId: true,
					priorScheduledAt: true,
					proposedScheduledAt: true,
					priorConfig: true,
					proposedConfig: true,
					priorMessage: true,
					proposedMessage: true,
					createdAt: true,
				},
				with: {
					actor: {
						columns: { id: true, displayName: true },
					},
					actorTeam: {
						columns: { id: true, name: true, tag: true },
					},
				},
				orderBy: [asc(scrimNegotiationRevisionTable.createdAt)],
			},
			maps: {
				columns: {
					id: true,
					mapOrder: true,
					mapName: true,
					mapType: true,
					gameMode: true,
					durationSeconds: true,
					result: true,
					homeScore: true,
					awayScore: true,
					ocrJobId: true,
				},
				with: {
					playerStats: {
						columns: {
							id: true,
							side: true,
							userId: true,
							teamId: true,
							playerName: true,
							hero: true,
							role: true,
							eliminations: true,
							assists: true,
							deaths: true,
							damage: true,
							healing: true,
							mitigation: true,
						},
						orderBy: [asc(scrimPlayerStatTable.playerName), asc(scrimPlayerStatTable.side)],
					},
				},
				orderBy: [asc(scrimMapTable.mapOrder)],
			},
			ocrJobs: {
				columns: {
					id: true,
					scrimId: true,
					screenshotType: true,
					scrimMapId: true,
					imageUrl: true,
					status: true,
					progressStage: true,
					errorCode: true,
					errorMessage: true,
					retryCount: true,
					submittedByUserId: true,
					providerName: true,
					providerModel: true,
					promptVersion: true,
					runAfter: true,
					processingTimeMs: true,
					confidenceFlags: true,
					validatedOutput: true,
					startedAt: true,
					completedAt: true,
					createdAt: true,
					updatedAt: true,
				},
				with: {
					submittedBy: {
						columns: {
							id: true,
							displayName: true,
						},
					},
				},
				orderBy: [desc(ocrJobTable.createdAt)],
			},
		},
	});
}

export type ScrimRow = NonNullable<Awaited<ReturnType<typeof findScrimWithRelations>>>;

export type ScrimSummaryRow = {
	id: string;
	status: ScrimRow["status"];
	message: string | null;
	config: ScrimRow["config"];
	scheduledAt: Date | null;
	startedAt: Date | null;
	endedAt: Date | null;
	homeMapScore: number;
	awayMapScore: number;
	createdAt: Date;
	updatedAt: Date;
	createdByUserId: string | null;
	createdBy: ScrimRow["createdBy"];
	homeTeam: ScrimRow["homeTeam"] & { isArchived: boolean };
	awayTeam: (ScrimRow["awayTeam"] & { isArchived: boolean }) | null;
	homeTeamNameSnapshot: string | null;
	homeTeamTagSnapshot: string | null;
	awayTeamNameSnapshot: string | null;
	awayTeamTagSnapshot: string | null;
	confirmations: ScrimRow["confirmations"];
	disputeResolution: ScrimRow["disputeResolution"];
};

export function toIsoDate(date: Date | null): string | null {
	return date?.toISOString() ?? null;
}

export type PublicScrimSummaryRow = ScrimSummaryRow;

export function mapBaseScrimSummary(scrim: ScrimSummaryRow): ScrimSummary {
	return {
		id: scrim.id,
		status: scrim.status,
		message: scrim.message ?? null,
		config: scrim.config ?? {},
		scheduledAt: toIsoDate(scrim.scheduledAt),
		startedAt: toIsoDate(scrim.startedAt),
		endedAt: toIsoDate(scrim.endedAt),
		homeMapScore: scrim.homeMapScore,
		awayMapScore: scrim.awayMapScore,
		createdAt: scrim.createdAt.toISOString(),
		updatedAt: scrim.updatedAt.toISOString(),
		createdByUserId: scrim.createdByUserId,
		createdByDisplayName: scrim.createdBy?.displayName ?? null,
		homeTeam: {
			id: scrim.homeTeam.id,
			name: scrim.homeTeam.name,
			tag: scrim.homeTeam.tag,
			organizationId: scrim.homeTeam.organizationId,
			organizationName: scrim.homeTeam.organization?.name ?? null,
			avatarUrl: scrim.homeTeam.avatarUrl ?? null,
			rating: scrim.homeTeam.rating,
			isArchived: scrim.homeTeam.isArchived,
		},
		awayTeam: scrim.awayTeam
			? {
					id: scrim.awayTeam.id,
					name: scrim.awayTeam.name,
					tag: scrim.awayTeam.tag,
					organizationId: scrim.awayTeam.organizationId,
					organizationName: scrim.awayTeam.organization?.name ?? null,
					avatarUrl: scrim.awayTeam.avatarUrl ?? null,
					rating: scrim.awayTeam.rating,
					isArchived: scrim.awayTeam.isArchived,
				}
			: null,
		homeTeamSnapshot:
			scrim.homeTeamNameSnapshot && scrim.homeTeamTagSnapshot
				? { name: scrim.homeTeamNameSnapshot, tag: scrim.homeTeamTagSnapshot }
				: null,
		awayTeamSnapshot:
			scrim.awayTeamNameSnapshot && scrim.awayTeamTagSnapshot
				? { name: scrim.awayTeamNameSnapshot, tag: scrim.awayTeamTagSnapshot }
				: null,
		pendingConfirmationCount: scrim.confirmations.filter(
			(confirmation) => confirmation.status !== "confirmed"
		).length,
		disputeResolution: scrim.disputeResolution ?? null,
	};
}
