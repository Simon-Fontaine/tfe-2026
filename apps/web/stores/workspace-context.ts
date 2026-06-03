import { create } from "zustand";

type WorkspaceScope = "personal" | "org" | "team";

interface WorkspaceContextState {
	scope: WorkspaceScope;
	selectedOrgId: string | null;
	selectedTeamId: string | null;
	setScope: (scope: WorkspaceScope) => void;
	selectOrg: (orgId: string | null) => void;
	selectTeam: (teamId: string | null) => void;
}

export const useWorkspaceContextStore = create<WorkspaceContextState>((set) => ({
	scope: "personal",
	selectedOrgId: null,
	selectedTeamId: null,
	setScope: (scope) => set({ scope }),
	selectOrg: (selectedOrgId) =>
		set({ selectedOrgId, selectedTeamId: null, scope: selectedOrgId ? "org" : "personal" }),
	selectTeam: (selectedTeamId) =>
		set({ selectedTeamId, scope: selectedTeamId ? "team" : "personal" }),
}));
