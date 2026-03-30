export type FieldErrors = Partial<Record<string, string[]>>;

export type SdkError = {
	message: string;
	status?: number;
	fieldErrors?: FieldErrors;
};

export type SdkResult<T> = { ok: true; data: T } | { ok: false; error: SdkError };

export type AuthTokenStrategy = {
	getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
	onResponse?: (response: Response) => Promise<void> | void;
};

export type SdkClientConfig = {
	baseUrl: string;
	fetchFn?: typeof fetch;
	auth?: AuthTokenStrategy;
};

export type MutationSuccess = { success: true };

export type ChatConversationType =
	| "scrim_lobby"
	| "scrim_negotiation"
	| "team"
	| "recruitment"
	| "direct";

export type ChatConversationSummary = {
	id: string;
	type: ChatConversationType;
	name: string;
	isArchived: boolean;
	scrimId: string | null;
	teamId: string | null;
	lfgApplicationId: string | null;
	lastMessagePreview: string | null;
	lastMessageAt: string | null;
	unreadCount: number;
	participantCount: number;
};

export type ChatParticipantSummary = {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	role: string;
	joinedAt: string;
	leftAt: string | null;
};

export type ChatMessage = {
	id: string;
	conversationId: string;
	senderId: string;
	senderDisplayName: string;
	senderAvatarUrl: string | null;
	content: string;
	replyToMessageId: string | null;
	isSystemMessage: boolean;
	editedAt: string | null;
	deletedAt: string | null;
	createdAt: string;
};

export type ChatMessagePage = {
	items: ChatMessage[];
	nextCursor: string | null;
};

export type ChatConversationDetail = ChatConversationSummary & {
	participants: ChatParticipantSummary[];
};

export type ChatRealtimeEvent =
	| { type: "chat.connected"; userId: string }
	| { type: "chat.pong" }
	| { type: "chat.error"; error: string; conversationId?: string }
	| { type: "conversation.subscribed"; conversationId: string }
	| { type: "conversation.unsubscribed"; conversationId: string }
	| { type: "conversation.typing"; conversationId: string; userId: string; isTyping: boolean }
	| { type: "conversation.message.created"; conversationId: string; message: ChatMessage | null }
	| {
			type: "conversation.read.updated";
			conversationId: string;
			userId: string;
			lastReadMessageId: string | null;
	  }
	| {
			type: "notification.created";
			notificationType: "new_message";
			conversationId: string;
			message: ChatMessage | null;
			senderId: string;
	  };
