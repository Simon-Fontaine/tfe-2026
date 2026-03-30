import type { Transport } from "../transport";
import type {
	ChatConversationDetail,
	ChatConversationSummary,
	ChatMessagePage,
	MutationSuccess,
	SdkResult,
} from "../types";

export type ListChatMessagesInput = {
	conversationId: string;
	cursor?: string;
	limit?: number;
};

export type SendChatMessageInput = {
	conversationId: string;
	content: string;
	replyToMessageId?: string;
};

export type MarkConversationReadInput = {
	conversationId: string;
	lastReadMessageId?: string;
};

export class ChatService {
	constructor(private readonly transport: Transport) {}

	createWebSocketUrl(): string {
		const httpBase = this.transport.getBaseUrl();
		const wsBase = httpBase.startsWith("https://")
			? `wss://${httpBase.slice("https://".length)}`
			: httpBase.startsWith("http://")
				? `ws://${httpBase.slice("http://".length)}`
				: httpBase;
		return `${wsBase}/api/chat/ws`;
	}

	listConversations(): Promise<SdkResult<ChatConversationSummary[]>> {
		return this.transport.get<ChatConversationSummary[]>("/api/chat/conversations");
	}

	getConversation(conversationId: string): Promise<SdkResult<ChatConversationDetail>> {
		return this.transport.get<ChatConversationDetail>(`/api/chat/conversations/${conversationId}`);
	}

	listMessages(input: ListChatMessagesInput): Promise<SdkResult<ChatMessagePage>> {
		const params = new URLSearchParams();
		if (input.cursor) params.set("cursor", input.cursor);
		if (typeof input.limit === "number") params.set("limit", String(input.limit));
		const qs = params.toString();
		return this.transport.get<ChatMessagePage>(
			`/api/chat/conversations/${input.conversationId}/messages${qs ? `?${qs}` : ""}`
		);
	}

	sendMessage(input: SendChatMessageInput): Promise<SdkResult<MutationSuccess>> {
		const { conversationId, ...body } = input;
		return this.transport.post<MutationSuccess>(
			`/api/chat/conversations/${conversationId}/messages`,
			body
		);
	}

	markRead(input: MarkConversationReadInput): Promise<SdkResult<MutationSuccess>> {
		const { conversationId, ...body } = input;
		return this.transport.post<MutationSuccess>(
			`/api/chat/conversations/${conversationId}/read`,
			body
		);
	}
}
