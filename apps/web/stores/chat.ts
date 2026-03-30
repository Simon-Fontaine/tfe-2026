import type { ChatConversationSummary, ChatMessage, UserPresence } from "@scrimflow/shared";
import { create } from "zustand";

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
	updateMessage(conversationId: string, message: ChatMessage): void;

	/** Mark a message as deleted by id. */
	deleteMessage(conversationId: string, messageId: string, deletedAt: string): void;

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
		set({ conversations });
	},

	setMessages(conversationId, messages, nextCursor) {
		set((s) => ({
			messages: { ...s.messages, [conversationId]: messages },
			nextCursors: { ...s.nextCursors, [conversationId]: nextCursor },
		}));
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
			// Replace optimistic placeholder if it shares the same tempId stored in content
			return { messages: { ...s.messages, [conversationId]: [...existing, message] } };
		});
		// Bump conversation unread count and last preview for non-active conversations
		set((s) => ({
			conversations: s.conversations.map((conv) => {
				if (conv.id !== conversationId) return conv;
				return {
					...conv,
					lastMessagePreview: message.content.slice(0, 100),
					lastMessageAt: message.createdAt,
				};
			}),
		}));
	},

	updateMessage(conversationId, message) {
		set((s) => ({
			messages: {
				...s.messages,
				[conversationId]: (s.messages[conversationId] ?? []).map((m) =>
					m.id === message.id ? message : m
				),
			},
		}));
	},

	deleteMessage(conversationId, messageId, deletedAt) {
		set((s) => ({
			messages: {
				...s.messages,
				[conversationId]: (s.messages[conversationId] ?? []).map((m) =>
					m.id === messageId ? { ...m, deletedAt, content: "[deleted]" } : m
				),
			},
		}));
	},

	upsertConversation(conversation) {
		set((s) => {
			const exists = s.conversations.some((c) => c.id === conversation.id);
			if (!exists) {
				return { conversations: [conversation, ...s.conversations] };
			}
			return {
				conversations: s.conversations.map((c) =>
					c.id === conversation.id ? { ...c, ...conversation } : c
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
