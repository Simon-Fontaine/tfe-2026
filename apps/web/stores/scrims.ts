import { create } from "zustand";

interface ScrimState {
	needsActionCount: number | null;
}

interface ScrimActions {
	hydrateNeedsActionCount(needsActionCount: number): void;
	setNeedsActionCount(needsActionCount: number): void;
}

export const useScrimStore = create<ScrimState & ScrimActions>((set) => ({
	needsActionCount: null,

	hydrateNeedsActionCount(needsActionCount) {
		set({ needsActionCount });
	},

	setNeedsActionCount(needsActionCount) {
		set({ needsActionCount });
	},
}));
