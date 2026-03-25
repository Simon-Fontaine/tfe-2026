import type { Transport } from "../transport";
import type { MutationSuccess, SdkResult } from "../types";

export type CreateOrgInput = { name: string; description?: string };
export type UpdateOrgInput = { orgId: string; name: string; description?: string };
export type DeleteOrgInput = { orgId: string; confirmName: string };
export type UpdateOrgMemberRoleInput = { orgId: string; memberId: string; role: string };
export type RemoveOrgMemberInput = { orgId: string; memberId: string };
export type InviteOrgMemberInput = { orgId: string; userId: string; role: string };
export type RespondOrgInviteInput = { inviteId: string; action: string };
export type ManageOrgInviteInput = { orgId: string; inviteId: string };

export class OrgsService {
	constructor(private readonly transport: Transport) {}

	create(input: CreateOrgInput): Promise<SdkResult<MutationSuccess & { orgId: string }>> {
		return this.transport.post<MutationSuccess & { orgId: string }>("/api/orgs", input);
	}

	update(input: UpdateOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(`/api/orgs/${input.orgId}`, {
			name: input.name,
			description: input.description,
		});
	}

	delete(input: DeleteOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/orgs/${input.orgId}`, {
			confirmName: input.confirmName,
		});
	}

	updateMemberRole(input: UpdateOrgMemberRoleInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(
			`/api/orgs/${input.orgId}/members/${input.memberId}/role`,
			{ role: input.role }
		);
	}

	removeMember(input: RemoveOrgMemberInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(
			`/api/orgs/${input.orgId}/members/${input.memberId}`
		);
	}

	invite(input: InviteOrgMemberInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/orgs/${input.orgId}/invites`, {
			userId: input.userId,
			role: input.role,
		});
	}

	respondToInvite(input: RespondOrgInviteInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/orgs/invites/${input.inviteId}/respond`, {
			action: input.action,
		});
	}

	cancelInvite(input: ManageOrgInviteInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(
			`/api/orgs/${input.orgId}/invites/${input.inviteId}`
		);
	}

	resendInvite(input: ManageOrgInviteInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(
			`/api/orgs/${input.orgId}/invites/${input.inviteId}/resend`
		);
	}
}
