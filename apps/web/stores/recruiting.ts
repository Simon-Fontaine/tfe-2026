import { create } from "zustand";

interface RecruitingState {
	pendingApplicationCount: number | null;
}

interface RecruitingActions {
	hydratePendingApplicationCount(pendingApplicationCount: number): void;
	setPendingApplicationCount(pendingApplicationCount: number): void;
}

export const useRecruitingStore = create<RecruitingState & RecruitingActions>((set) => ({
	pendingApplicationCount: null,

	hydratePendingApplicationCount(pendingApplicationCount) {
		set({ pendingApplicationCount });
	},

	setPendingApplicationCount(pendingApplicationCount) {
		set({ pendingApplicationCount });
	},
}));
