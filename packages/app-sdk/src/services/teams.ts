import type { Transport } from "../transport";
import type { MutationSuccess, SdkResult } from "../types";

export type CreateTeamInput = {
	orgId: string;
	name: string;
	tag: string;
	description?: string;
};

export type UpdateTeamInput = {
	teamId: string;
	orgId: string;
	name: string;
	tag: string;
	description?: string;
};

export type TeamOrgInput = { teamId: string; orgId: string };
export type TeamScopedInput = { teamId: string };

export class TeamsService {
	constructor(private readonly transport: Transport) {}

	create(input: CreateTeamInput): Promise<SdkResult<MutationSuccess & { teamId: string }>> {
		return this.transport.post<MutationSuccess & { teamId: string }>("/api/teams", input);
	}

	update(input: UpdateTeamInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(`/api/teams/${input.teamId}`, {
			orgId: input.orgId,
			name: input.name,
			tag: input.tag,
			description: input.description,
		});
	}

	toggleRecruiting(input: TeamOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(`/api/teams/${input.teamId}/recruiting`, {
			orgId: input.orgId,
		});
	}

	archive(input: TeamOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/${input.teamId}/archive`, {
			orgId: input.orgId,
		});
	}

	unarchive(input: TeamOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/${input.teamId}/unarchive`, {
			orgId: input.orgId,
		});
	}

	delete(input: TeamOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/teams/${input.teamId}`, {
			orgId: input.orgId,
		});
	}

	leave(input: TeamScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/teams/${input.teamId}/leave`);
	}
}
