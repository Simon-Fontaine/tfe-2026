import type {
	ChatConversationDetail,
	ChatConversationSummary,
	ChatMessagePage,
	CreateDirectConversationResult,
	UserPresence,
} from "@scrimflow/shared";
import { cache } from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export const getChatConversations = cache(async (): Promise<ChatConversationSummary[]> => {
	const res = await apiGet<ChatConversationSummary[]>(apiRoutes.chat.conversations);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getChatConversation = cache(
	async (conversationId: string): Promise<ChatConversationDetail | null> => {
		const res = await apiGet<ChatConversationDetail>(apiRoutes.chat.byId(conversationId));
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

export const getChatMessages = cache(async (conversationId: string): Promise<ChatMessagePage> => {
	const res = await apiGet<ChatMessagePage>(apiRoutes.chat.messages(conversationId));
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export async function createDirectConversation(
	targetUserId: string
): Promise<CreateDirectConversationResult | null> {
	const res = await apiPost<CreateDirectConversationResult>(apiRoutes.chat.createDirect, {
		targetUserId,
	});
	if ("data" in res) return res.data;
	return null;
}

export async function editChatMessage(
	conversationId: string,
	messageId: string,
	content: string
): Promise<boolean> {
	const res = await apiPatch(apiRoutes.chat.message(conversationId, messageId), { content });
	return "success" in res && res.success;
}

export async function deleteChatMessage(
	conversationId: string,
	messageId: string
): Promise<boolean> {
	const res = await apiDelete(apiRoutes.chat.message(conversationId, messageId));
	return "success" in res && res.success;
}

export const getUserPresence = cache(async (userId: string): Promise<UserPresence | null> => {
	const res = await apiGet<UserPresence>(apiRoutes.chat.presence(userId));
	if ("data" in res) return res.data;
	return null;
});
