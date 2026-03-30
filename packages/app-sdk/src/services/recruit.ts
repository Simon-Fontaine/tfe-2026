import type { Transport } from "../transport";
import type { MutationSuccess, SdkResult } from "../types";

export type RecruitmentPostCategory = "lft" | "lfp" | "lfr" | "lfs";
export type RecruitmentOwnerType = "player" | "team" | "organization";
export type MemberType = "player" | "staff";
export type StaffRole = "coach" | "analyst" | "manager" | "staff";
export type Ow2Role = "tank" | "damage" | "support";

export type CreateRecruitmentPostInput = {
	category: RecruitmentPostCategory;
	ownerType: RecruitmentOwnerType;
	title: string;
	description?: string;
	memberType: MemberType;
	staffRole?: StaffRole;
	gameRoles?: Ow2Role[];
	minRank?: string;
	maxRank?: string;
	minSr?: number;
	maxSr?: number;
	region?: string;
	expiresAt?: string;
	teamId?: string;
	organizationId?: string;
};

export type UpdateRecruitmentPostInput = {
	postId: string;
	category?: RecruitmentPostCategory;
	status?: "open" | "closed" | "fulfilled" | "expired";
	title?: string;
	description?: string;
	memberType?: MemberType;
	staffRole?: StaffRole;
	gameRoles?: Ow2Role[];
	minRank?: string;
	maxRank?: string;
	minSr?: number;
	maxSr?: number;
	region?: string;
	expiresAt?: string;
};

export type DeleteRecruitmentPostInput = {
	postId: string;
};

export type CreateRecruitmentResponseInput = {
	postId: string;
	message?: string;
	senderTeamId?: string;
	senderOrganizationId?: string;
};

export type WithdrawRecruitmentResponseInput = {
	responseId: string;
};

export type DecideRecruitmentResponseInput = {
	responseId: string;
	action: "accept" | "reject";
	gameRole?: Ow2Role;
	staffRole?: StaffRole;
};

export class RecruitService {
	constructor(private readonly transport: Transport) {}

	createPost(
		input: CreateRecruitmentPostInput
	): Promise<SdkResult<MutationSuccess & { postId: string }>> {
		return this.transport.post<MutationSuccess & { postId: string }>("/api/posts", input);
	}

	updatePost(input: UpdateRecruitmentPostInput): Promise<SdkResult<MutationSuccess>> {
		const { postId, ...body } = input;
		return this.transport.patch<MutationSuccess>(`/api/posts/${postId}`, body);
	}

	deletePost(input: DeleteRecruitmentPostInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/posts/${input.postId}`);
	}

	respondToPost(
		input: CreateRecruitmentResponseInput
	): Promise<SdkResult<MutationSuccess & { responseId: string; conversationId: string }>> {
		const { postId, ...body } = input;
		return this.transport.post<MutationSuccess & { responseId: string; conversationId: string }>(
			`/api/posts/${postId}/responses`,
			body
		);
	}

	withdrawResponse(input: WithdrawRecruitmentResponseInput): Promise<SdkResult<MutationSuccess>> {
		return this.transport.delete<MutationSuccess>(`/api/responses/${input.responseId}`);
	}

	decideResponse(input: DecideRecruitmentResponseInput): Promise<SdkResult<MutationSuccess>> {
		const { responseId, ...body } = input;
		return this.transport.post<MutationSuccess>(`/api/responses/${responseId}/decision`, body);
	}
}
