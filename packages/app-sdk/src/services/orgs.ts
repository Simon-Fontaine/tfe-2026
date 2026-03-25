import type { Transport } from "../transport";
import type { MutationSuccess, SdkResult } from "../types";

export type CreateOrgInput = { name: string; description?: string };
export type UpdateOrgInput = { orgId: string; name: string; slug?: string; description?: string };
export type DeleteOrgInput = { orgId: string; confirmName: string };
export type TransferOrgOwnershipInput = { orgId: string; memberId: string };
export type UpdateOrgMemberRoleInput = { orgId: string; memberId: string; role: string };
export type RemoveOrgMemberInput = { orgId: string; memberId: string };
export type InviteOrgMemberInput = { orgId: string; userId: string; role: string };
export type RespondOrgInviteInput = { inviteId: string; action: string };
export type ManageOrgInviteInput = { orgId: string; inviteId: string };
export type CreateOrgRequestInput = { orgId: string; message?: string };
export type RespondOrgRequestInput = { orgId: string; requestId: string; action: string };
export type OrgScopedInput = { orgId: string };

export class OrgsService {
	constructor(private readonly transport: Transport) {}

	create(input: CreateOrgInput): Promise<SdkResult<MutationSuccess & { orgId: string }>> {
		return this.transport.post<MutationSuccess & { orgId: string }>("/api/orgs", input);
	}

	update(input: UpdateOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(`/api/orgs/${input.orgId}`, {
			name: input.name,
			slug: input.slug,
			description: input.description,
		});
	}

	delete(input: DeleteOrgInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/orgs/${input.orgId}`, {
			confirmName: input.confirmName,
		});
	}

	transferOwnership(input: TransferOrgOwnershipInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/orgs/${input.orgId}/ownership`, {
			memberId: input.memberId,
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

	requestToJoin(input: CreateOrgRequestInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(`/api/orgs/${input.orgId}/requests`, {
			message: input.message,
		});
	}

	respondToRequest(input: RespondOrgRequestInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.post<MutationSuccess>(
			`/api/orgs/${input.orgId}/requests/${input.requestId}/respond`,
			{ action: input.action }
		);
	}

	leave(input: OrgScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/orgs/${input.orgId}/leave`);
	}
}
