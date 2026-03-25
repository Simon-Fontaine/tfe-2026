import type { Transport } from "../transport";
import type { MutationSuccess, SdkResult } from "../types";

export type CreateOrgInput = {
	name: string;
	description?: string;
	avatarUrl?: string;
	bannerUrl?: string;
};
export type UpdateOrgInput = {
	orgId: string;
	name: string;
	slug?: string;
	description?: string;
	avatarUrl?: string;
	bannerUrl?: string;
};
export type DeleteOrgInput = { orgId: string; confirmName: string };
export type TransferOrgOwnershipInput = { orgId: string; memberId: string };
export type UpdateOrgMemberRoleInput = { orgId: string; memberId: string; role: string };
export type UpdateOrgMemberInput = {
	orgId: string;
	memberId: string;
	role?: string;
	memberType?: "player" | "staff";
	staffRole?: "coach" | "analyst" | "manager" | "staff";
	gameRole?: "tank" | "damage" | "support";
};
export type RemoveOrgMemberInput = { orgId: string; memberId: string };
export type InviteOrgMemberInput = {
	orgId: string;
	userId: string;
	role: string;
	memberType?: "player" | "staff";
	staffRole?: "coach" | "analyst" | "manager" | "staff";
	gameRole?: "tank" | "damage" | "support";
};
export type RespondOrgInviteInput = { inviteId: string; action: string };
export type ManageOrgInviteInput = { orgId: string; inviteId: string };
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
			avatarUrl: input.avatarUrl,
			bannerUrl: input.bannerUrl,
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

	updateMember(input: UpdateOrgMemberInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.patch<MutationSuccess>(
			`/api/orgs/${input.orgId}/members/${input.memberId}/role`,
			{
				role: input.role,
				memberType: input.memberType,
				staffRole: input.staffRole,
				gameRole: input.gameRole,
			}
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
			memberType: input.memberType,
			staffRole: input.staffRole,
			gameRole: input.gameRole,
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

	leave(input: OrgScopedInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/orgs/${input.orgId}/leave`);
	}
}
