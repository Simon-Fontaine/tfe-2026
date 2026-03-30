import { create } from "zustand";

export type DashboardScope = "personal" | "org" | "team";

interface DashboardContextState {
	scope: DashboardScope;
	selectedOrgId: string | null;
	selectedTeamId: string | null;
	setScope: (scope: DashboardScope) => void;
	selectOrg: (orgId: string | null) => void;
	selectTeam: (teamId: string | null) => void;
}

export const useDashboardContextStore = create<DashboardContextState>((set) => ({
	scope: "personal",
	selectedOrgId: null,
	selectedTeamId: null,
	setScope: (scope) => set({ scope }),
	selectOrg: (selectedOrgId) =>
		set({ selectedOrgId, selectedTeamId: null, scope: selectedOrgId ? "org" : "personal" }),
	selectTeam: (selectedTeamId) =>
		set({ selectedTeamId, scope: selectedTeamId ? "team" : "personal" }),
}));
