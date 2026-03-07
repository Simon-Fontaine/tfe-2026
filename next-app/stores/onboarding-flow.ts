import { create } from "zustand";

import type { OW2Rank, OW2Role } from "@/lib/ow2";

export type { OW2Rank, OW2Role };

// ─── Step definitions ─────────────────────────────────────────────────────────

export type OnboardingStep = "battletag" | "roles-and-rank" | "hero-pool";

// ─── State ────────────────────────────────────────────────────────────────────

interface OnboardingData {
	battletag: string;
	primaryRole: OW2Role | null;
	secondaryRole: OW2Role | null;
	rank: OW2Rank | null;
	/** null for Unranked. */
	rankDivision: number | null;
	heroPool: string[];
}

interface OnboardingFlowState {
	step: OnboardingStep;
	data: OnboardingData;
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
	},

	transitionTo: (step, partialData) =>
		set((state) => ({
			step,
			data: { ...state.data, ...partialData },
		})),
}));
