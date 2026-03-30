import type {
	ChatConversationDetail,
	ChatConversationSummary,
	ChatMessagePage,
} from "@scrimflow/shared";
import { cache } from "react";

import { apiGet } from "@/lib/api-client";
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
