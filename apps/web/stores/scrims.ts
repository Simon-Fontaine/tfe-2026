import { create } from "zustand";

interface ScrimState {
	teamId: string | null;
	needsActionCount: number | null;
}

interface ScrimActions {
	hydrateNeedsActionCount(teamId: string, needsActionCount: number): void;
	resetNeedsActionCount(): void;
}

export const useScrimStore = create<ScrimState & ScrimActions>((set) => ({
	teamId: null,
	needsActionCount: null,

	hydrateNeedsActionCount(teamId, needsActionCount) {
		set({ teamId, needsActionCount });
	},

	resetNeedsActionCount() {
		set({ teamId: null, needsActionCount: null });
	},
}));
