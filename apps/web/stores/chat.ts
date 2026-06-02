import type { ChatConversationSummary, ChatMessage, UserPresence } from "@scrimflow/shared";
import { create } from "zustand";

function sortConversations(conversations: ChatConversationSummary[]) {
	return [...conversations].sort((left, right) => {
		const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
		const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
		return rightTime - leftTime;
	});
}

/**
 * Resolve an ordered, server-scoped id list against the normalized store and
 * return the present conversations sorted by recency. The caller (a page/context)
 * owns the id list, so the client never re-derives scope from `teamId`.
 */
export function selectOrderedConversations(
	conversationsById: Record<string, ChatConversationSummary>,
	orderedIds: string[]
): ChatConversationSummary[] {
	const present: ChatConversationSummary[] = [];
	for (const id of orderedIds) {
		const conversation = conversationsById[id];
		if (conversation) present.push(conversation);
	}
	return sortConversations(present);
}

/** Live conversations of a given type that are not already in the server-scoped set. */
export function selectLiveConversationsByType(
	conversationsById: Record<string, ChatConversationSummary>,
	type: ChatConversationSummary["type"],
	excludeIds: Set<string>
): ChatConversationSummary[] {
	const matches: ChatConversationSummary[] = [];
	for (const conversation of Object.values(conversationsById)) {
		if (conversation.type === type && !excludeIds.has(conversation.id)) {
			matches.push(conversation);
		}
	}
	return sortConversations(matches);
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface ChatState {
	/**
	 * All known conversations keyed by id. Normalized so multiple contexts (team
	 * chat, recruitment, …) can coexist without overwriting each other. Each
	 * context renders only the ids the server scoped to it.
	 */
	conversationsById: Record<string, ChatConversationSummary>;
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
	/** Upsert many conversations (server hydration / reconnect resync). Never drops others. */
	mergeConversations(conversations: ChatConversationSummary[]): void;

	/** Remove conversations the user lost access to. */
	removeConversations(ids: string[]): void;

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

	/** Seed/refresh presence for many users at once (e.g. from a participant fetch). */
	setPresences(presences: UserPresence[]): void;

	setTyping(conversationId: string, userId: string, isTyping: boolean): void;
}

function mergeConversationInto(
	conversationsById: Record<string, ChatConversationSummary>,
	conversation: ChatConversationSummary
): Record<string, ChatConversationSummary> {
	const existing = conversationsById[conversation.id];
	return {
		...conversationsById,
		[conversation.id]: existing ? { ...existing, ...conversation } : conversation,
	};
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState & ChatActions>((set) => ({
	conversationsById: {},
	messages: {},
	nextCursors: {},
	loadingOlder: {},
	presence: {},
	typing: {},

	mergeConversations(conversations) {
		set((s) => {
			let next = s.conversationsById;
			let changed = false;
			for (const conversation of conversations) {
				const merged = mergeConversationInto(next, conversation);
				if (merged !== next || merged[conversation.id] !== next[conversation.id]) {
					next = merged;
					changed = true;
				}
			}
			return changed ? { conversationsById: next } : {};
		});
	},

	removeConversations(ids) {
		set((s) => {
			if (ids.length === 0) return {};
			const next = { ...s.conversationsById };
			let changed = false;
			for (const id of ids) {
				if (id in next) {
					delete next[id];
					changed = true;
				}
			}
			return changed ? { conversationsById: next } : {};
		});
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

			const nextMessages =
				matchingTempIndex !== -1
					? existing.map((m, index) => (index === matchingTempIndex ? message : m))
					: [...existing, message];

			// Bump last preview / recency for the conversation (if known).
			const conversation = s.conversationsById[conversationId];
			const nextConversationsById = conversation
				? {
						...s.conversationsById,
						[conversationId]: {
							...conversation,
							lastMessagePreview: message.content.slice(0, 100),
							lastMessageAt: message.createdAt,
						},
					}
				: s.conversationsById;

			return {
				messages: { ...s.messages, [conversationId]: nextMessages },
				conversationsById: nextConversationsById,
			};
		});
	},

	updateMessage(conversationId, message, conversation) {
		set((s) => {
			const updates: Partial<ChatState> = {};

			const existing = s.messages[conversationId];
			if (existing) {
				updates.messages = {
					...s.messages,
					[conversationId]: existing.map((m) => (m.id === message.id ? message : m)),
				};
			}

			const current = s.conversationsById[conversationId];
			if (conversation) {
				updates.conversationsById = mergeConversationInto(s.conversationsById, conversation);
			} else if (current && current.lastMessageAt === message.createdAt) {
				updates.conversationsById = {
					...s.conversationsById,
					[conversationId]: {
						...current,
						lastMessagePreview: message.deletedAt ? "[deleted]" : message.content.slice(0, 100),
						lastMessageAt: message.createdAt,
					},
				};
			}

			return updates;
		});
	},

	deleteMessage(conversationId, messageId, deletedAt, conversation) {
		set((s) => {
			const updates: Partial<ChatState> = {};

			const existing = s.messages[conversationId];
			const deletedMessage = existing?.find((m) => m.id === messageId);
			if (existing) {
				updates.messages = {
					...s.messages,
					[conversationId]: existing.map((m) =>
						m.id === messageId ? { ...m, deletedAt, content: "[deleted]" } : m
					),
				};
			}

			const current = s.conversationsById[conversationId];
			if (conversation) {
				updates.conversationsById = mergeConversationInto(s.conversationsById, conversation);
			} else if (current && deletedMessage && current.lastMessageAt === deletedMessage.createdAt) {
				updates.conversationsById = {
					...s.conversationsById,
					[conversationId]: { ...current, lastMessagePreview: "[deleted]" },
				};
			}

			return updates;
		});
	},

	upsertConversation(conversation) {
		set((s) => ({ conversationsById: mergeConversationInto(s.conversationsById, conversation) }));
	},

	clearUnread(conversationId) {
		set((s) => {
			const existing = s.conversationsById[conversationId];
			if (!existing || existing.unreadCount === 0) return {};
			return {
				conversationsById: {
					...s.conversationsById,
					[conversationId]: { ...existing, unreadCount: 0 },
				},
			};
		});
	},

	setPresence(presence) {
		set((s) => ({ presence: { ...s.presence, [presence.userId]: presence } }));
	},

	setPresences(presences) {
		if (presences.length === 0) return;
		set((s) => {
			const next = { ...s.presence };
			for (const presence of presences) {
				next[presence.userId] = presence;
			}
			return { presence: next };
		});
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
