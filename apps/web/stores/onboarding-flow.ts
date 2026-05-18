import type {
	AvailabilityIntent,
	OnboardingProgress,
	ParticipationIntent,
} from "@scrimflow/shared";
import { create } from "zustand";
import type { OW2Rank, OW2Role } from "@/lib/ow2";

export type { OW2Rank, OW2Role };

// ─── Step definitions ─────────────────────────────────────────────────────────

export type OnboardingStep = "battletag" | "roles-and-rank" | "hero-pool" | "intent" | "complete";

// ─── State ────────────────────────────────────────────────────────────────────

interface OnboardingData {
	battletag: string;
	primaryRole: OW2Role | null;
	secondaryRole: OW2Role | null;
	rank: OW2Rank | null;
	/** null for Unranked. */
	rankDivision: number | null;
	heroPool: string[];
	participationIntent: ParticipationIntent | null;
	availabilityIntent: AvailabilityIntent | null;
}

interface OnboardingFlowState {
	step: OnboardingStep;
	data: OnboardingData;
	hydrated: boolean;
	hydratedProgressKey: string | null;
	hydrate: (progress: OnboardingProgress, progressKey: string) => void;
	transitionTo: (step: OnboardingStep, partialData?: Partial<OnboardingData>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOnboardingFlow = create<OnboardingFlowState>((set) => ({
	step: "battletag",
	data: {
		battletag: "",
		primaryRole: null,
		secondaryRole: null,
		rank: null,
		rankDivision: null,
		heroPool: [],
		participationIntent: null,
		availabilityIntent: null,
	},
	hydrated: false,
	hydratedProgressKey: null,

	hydrate: (progress, progressKey) =>
		set((state) => ({
			step: progress.currentStep,
			hydrated: true,
			hydratedProgressKey: progressKey,
			data: {
				...state.data,
				battletag: progress.data.battletag ?? "",
				primaryRole: progress.data.primaryRole ?? null,
				secondaryRole: progress.data.secondaryRole ?? null,
				rank: (progress.data.rank as OW2Rank | null | undefined) ?? null,
				rankDivision: progress.data.rankDivision ?? null,
				heroPool: progress.data.heroPool ?? [],
				participationIntent: progress.data.participationIntent ?? null,
				availabilityIntent: progress.data.availabilityIntent ?? null,
			},
		})),

	transitionTo: (step, partialData) =>
		set((state) => ({
			step,
			data: { ...state.data, ...partialData },
		})),
}));
