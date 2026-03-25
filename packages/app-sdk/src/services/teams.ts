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
	name: string;
	tag: string;
	description?: string;
};

export type TeamScopedInput = { teamId: string };
export type AddTeamMemberInput = {
	teamId: string;
	userId: string;
	roleInTeam: string;
	status: string;
	permissionRole?: string;
};
export type UpdateTeamMemberInput = {
	teamId: string;
	memberId: string;
	roleInTeam?: string;
	status?: string;
	permissionRole?: string;
};
export type InviteToTeamInput = {
	teamId: string;
	userId: string;
	roleInTeam: string;
	permissionRole?: string;
};
export type ManageTeamInviteInput = { teamId: string; inviteId: string };
export type RespondTeamInviteInput = { inviteId: string; action: string };
export type CreateTeamRequestInput = {
	teamId: string;
	requestedRoleInTeam: string;
	message?: string;
};
export type RespondTeamRequestInput = { teamId: string; requestId: string; action: string };

export class TeamsService {
	constructor(private readonly transport: Transport) {}

	create(input: CreateTeamInput): Promise<SdkResult<MutationSuccess & { teamId: string }>> {
		return this.transport.post<MutationSuccess & { teamId: string }>("/api/teams", input);
	}

	update(input: UpdateTeamInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(`/api/teams/${input.teamId}`, {
			name: input.name,
			tag: input.tag,
			description: input.description,
		});
	}

	toggleRecruiting(input: TeamScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(`/api/teams/${input.teamId}/recruiting`, {});
	}

	archive(input: TeamScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/${input.teamId}/archive`, {});
	}

	unarchive(input: TeamScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/${input.teamId}/unarchive`, {});
	}

	delete(input: TeamScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/teams/${input.teamId}`, {});
	}

	leave(input: TeamScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/teams/${input.teamId}/leave`);
	}

	addMember(input: AddTeamMemberInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/${input.teamId}/roster`, {
			userId: input.userId,
			roleInTeam: input.roleInTeam,
			status: input.status,
			permissionRole: input.permissionRole,
		});
	}

	updateMember(input: UpdateTeamMemberInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(
			`/api/teams/${input.teamId}/roster/${input.memberId}`,
			{
				roleInTeam: input.roleInTeam,
				status: input.status,
				permissionRole: input.permissionRole,
			}
		);
	}

	removeMember(input: { teamId: string; memberId: string }): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(
			`/api/teams/${input.teamId}/roster/${input.memberId}`
		);
	}

	updateMemberPermission(input: {
		teamId: string;
		memberId: string;
		permissionRole: string;
	}): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(
			`/api/teams/${input.teamId}/members/${input.memberId}/role`,
			{ permissionRole: input.permissionRole }
		);
	}

	invite(input: InviteToTeamInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/${input.teamId}/invites`, {
			userId: input.userId,
			roleInTeam: input.roleInTeam,
			permissionRole: input.permissionRole,
		});
	}

	cancelInvite(input: ManageTeamInviteInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(
			`/api/teams/${input.teamId}/invites/${input.inviteId}`
		);
	}

	resendInvite(input: ManageTeamInviteInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(
			`/api/teams/${input.teamId}/invites/${input.inviteId}/resend`
		);
	}

	respondToInvite(input: RespondTeamInviteInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/invites/${input.inviteId}/respond`, {
			action: input.action,
		});
	}

	requestToJoin(input: CreateTeamRequestInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/teams/${input.teamId}/requests`, {
			requestedRoleInTeam: input.requestedRoleInTeam,
			message: input.message,
		});
	}

	respondToRequest(input: RespondTeamRequestInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(
			`/api/teams/${input.teamId}/requests/${input.requestId}/respond`,
			{ action: input.action }
		);
	}
}
