import type { ChatConversationSummary, ChatMessage, UserPresence } from "@scrimflow/shared";
import { create } from "zustand";

function sortConversations(conversations: ChatConversationSummary[]) {
	return [...conversations].sort((left, right) => {
		const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
		const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
		return rightTime - leftTime;
	});
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface ChatState {
	/** All conversations for the current context (hydrated from server). */
	conversations: ChatConversationSummary[];
	/** Loaded messages keyed by conversationId (newest last). */
	messages: Record<string, ChatMessage[]>;
	/** Next pagination cursor keyed by conversationId. null = no more pages. */
	nextCursors: Record<string, string | null>;
	/** Whether older messages are being loaded for a conversation. */
	loadingOlder: Record<string, boolean>;
	/** User presence keyed by userId. */
	presence: Record<string, UserPresence>;
	/** Active typers keyed by conversationId → userId[]. */
	typing: Record<string, string[]>;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface ChatActions {
	setConversations(conversations: ChatConversationSummary[]): void;

	/** Replace the full message list for a conversation (initial load). */
	setMessages(conversationId: string, messages: ChatMessage[], nextCursor: string | null): void;

	/** Prepend older messages fetched via pagination. */
	prependMessages(conversationId: string, messages: ChatMessage[], nextCursor: string | null): void;

	setLoadingOlder(conversationId: string, value: boolean): void;

	/** Append a single new message (from WS or optimistic). */
	appendMessage(conversationId: string, message: ChatMessage): void;

	/** Replace a message by id (edit or optimistic confirm). */
	updateMessage(
		conversationId: string,
		message: ChatMessage,
		conversation?: ChatConversationSummary
	): void;

	/** Mark a message as deleted by id. */
	deleteMessage(
		conversationId: string,
		messageId: string,
		deletedAt: string,
		conversation?: ChatConversationSummary
	): void;

	/** Update conversation summary (unread count, last preview, etc.). */
	upsertConversation(conversation: ChatConversationSummary): void;

	clearUnread(conversationId: string): void;

	setPresence(presence: UserPresence): void;

	setTyping(conversationId: string, userId: string, isTyping: boolean): void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState & ChatActions>((set) => ({
	conversations: [],
	messages: {},
	nextCursors: {},
	loadingOlder: {},
	presence: {},
	typing: {},

	setConversations(conversations) {
		set({ conversations: sortConversations(conversations) });
	},

	setMessages(conversationId, messages, nextCursor) {
		set((s) => {
			const merged = new Map<string, ChatMessage>();
			for (const message of messages) merged.set(message.id, message);
			for (const message of s.messages[conversationId] ?? []) merged.set(message.id, message);

			return {
				messages: {
					...s.messages,
					[conversationId]: [...merged.values()].sort(
						(left, right) =>
							new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
					),
				},
				nextCursors: { ...s.nextCursors, [conversationId]: nextCursor },
			};
		});
	},

	prependMessages(conversationId, older, nextCursor) {
		set((s) => ({
			messages: {
				...s.messages,
				[conversationId]: [...older, ...(s.messages[conversationId] ?? [])],
			},
			nextCursors: { ...s.nextCursors, [conversationId]: nextCursor },
		}));
	},

	setLoadingOlder(conversationId, value) {
		set((s) => ({ loadingOlder: { ...s.loadingOlder, [conversationId]: value } }));
	},

	appendMessage(conversationId, message) {
		set((s) => {
			const existing = s.messages[conversationId] ?? [];
			// Avoid duplicate (optimistic + server echo)
			if (existing.some((m) => m.id === message.id)) return {};
			const matchingTempIndex = existing.findLastIndex(
				(m) =>
					m.id.startsWith("temp-") &&
					m.senderId === message.senderId &&
					!!message.clientNonce &&
					m.clientNonce === message.clientNonce &&
					!m.deletedAt
			);
			if (matchingTempIndex !== -1) {
				const next = [...existing];
				next[matchingTempIndex] = message;
				return { messages: { ...s.messages, [conversationId]: next } };
			}
			return { messages: { ...s.messages, [conversationId]: [...existing, message] } };
		});
		// Bump conversation unread count and last preview for non-active conversations
		set((s) => ({
			conversations: sortConversations(
				s.conversations.map((conv) => {
					if (conv.id !== conversationId) return conv;
					return {
						...conv,
						lastMessagePreview: message.content.slice(0, 100),
						lastMessageAt: message.createdAt,
					};
				})
			),
		}));
	},

	updateMessage(conversationId, message, conversation) {
		set((s) => {
			const existing = s.messages[conversationId];
			const updates: Partial<ChatState> = {};

			if (existing) {
				updates.messages = {
					...s.messages,
					[conversationId]: existing.map((m) => (m.id === message.id ? message : m)),
				};
			}

			updates.conversations = sortConversations(
				s.conversations.map((conv) => {
					if (conv.id !== conversationId) return conv;
					if (conversation) return { ...conv, ...conversation };
					if (conv.lastMessageAt === message.createdAt) {
						return {
							...conv,
							lastMessagePreview: message.deletedAt ? "[deleted]" : message.content.slice(0, 100),
							lastMessageAt: message.createdAt,
						};
					}
					return conv;
				})
			);

			return updates;
		});
	},

	deleteMessage(conversationId, messageId, deletedAt, conversation) {
		set((s) => {
			const existing = s.messages[conversationId];
			const deletedMessage = existing?.find((m) => m.id === messageId);
			const updates: Partial<ChatState> = {};

			if (existing) {
				updates.messages = {
					...s.messages,
					[conversationId]: existing.map((m) =>
						m.id === messageId ? { ...m, deletedAt, content: "[deleted]" } : m
					),
				};
			}

			updates.conversations = sortConversations(
				s.conversations.map((conv) => {
					if (conv.id !== conversationId) return conv;
					if (conversation) return { ...conv, ...conversation };
					if (deletedMessage && conv.lastMessageAt === deletedMessage.createdAt) {
						return { ...conv, lastMessagePreview: "[deleted]" };
					}
					return conv;
				})
			);

			return updates;
		});
	},

	upsertConversation(conversation) {
		set((s) => {
			const exists = s.conversations.some((c) => c.id === conversation.id);
			if (!exists) {
				return { conversations: sortConversations([conversation, ...s.conversations]) };
			}
			return {
				conversations: sortConversations(
					s.conversations.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
				),
			};
		});
	},

	clearUnread(conversationId) {
		set((s) => ({
			conversations: s.conversations.map((c) =>
				c.id === conversationId ? { ...c, unreadCount: 0 } : c
			),
		}));
	},

	setPresence(presence) {
		set((s) => ({ presence: { ...s.presence, [presence.userId]: presence } }));
	},

	setTyping(conversationId, userId, isTyping) {
		set((s) => {
			const current = s.typing[conversationId] ?? [];
			const updated = isTyping
				? current.includes(userId)
					? current
					: [...current, userId]
				: current.filter((id) => id !== userId);
			return { typing: { ...s.typing, [conversationId]: updated } };
		});
	},
}));
