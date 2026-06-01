import * as v from "valibot";

export const SendChatMessageSchema = v.object({
	conversationId: v.pipe(v.string(), v.uuid("Invalid conversation ID")),
	content: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "Message cannot be empty"),
		v.maxLength(2000, "Message cannot exceed 2000 characters")
	),
	replyToMessageId: v.optional(v.pipe(v.string(), v.uuid("Invalid reply message ID"))),
	clientNonce: v.optional(v.pipe(v.string(), v.uuid("Invalid client nonce"))),
});

export type SendChatMessageInput = v.InferOutput<typeof SendChatMessageSchema>;

export const ReadConversationSchema = v.object({
	conversationId: v.pipe(v.string(), v.uuid("Invalid conversation ID")),
	lastReadMessageId: v.optional(v.pipe(v.string(), v.uuid("Invalid message ID"))),
});

export type ReadConversationInput = v.InferOutput<typeof ReadConversationSchema>;

export const EditChatMessageSchema = v.object({
	content: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "Message cannot be empty"),
		v.maxLength(2000, "Message cannot exceed 2000 characters")
	),
});

export type EditChatMessageInput = v.InferOutput<typeof EditChatMessageSchema>;

export const CreateDirectConversationSchema = v.object({
	targetUserId: v.pipe(v.string(), v.uuid("Invalid user ID")),
});

export type CreateDirectConversationInput = v.InferOutput<typeof CreateDirectConversationSchema>;
