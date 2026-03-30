type ChatSocket = {
	send: (payload: string) => unknown;
};

type SocketMeta = {
	userId: string;
	subscriptions: Set<string>;
};

const socketMeta = new Map<ChatSocket, SocketMeta>();
const userSockets = new Map<string, Set<ChatSocket>>();
const conversationSockets = new Map<string, Set<ChatSocket>>();

function send(ws: ChatSocket, payload: unknown) {
	ws.send(JSON.stringify(payload));
}

function getOrCreateSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
	const existing = map.get(key);
	if (existing) return existing;
	const next = new Set<V>();
	map.set(key, next);
	return next;
}

export function registerChatSocket(ws: ChatSocket, userId: string) {
	socketMeta.set(ws, { userId, subscriptions: new Set() });
	getOrCreateSet(userSockets, userId).add(ws);
	send(ws, { type: "chat.connected", userId });
}

export function unregisterChatSocket(ws: ChatSocket) {
	const meta = socketMeta.get(ws);
	if (!meta) return;

	for (const conversationId of meta.subscriptions) {
		const sockets = conversationSockets.get(conversationId);
		if (!sockets) continue;
		sockets.delete(ws);
		if (sockets.size === 0) conversationSockets.delete(conversationId);
	}

	const socketsForUser = userSockets.get(meta.userId);
	if (socketsForUser) {
		socketsForUser.delete(ws);
		if (socketsForUser.size === 0) userSockets.delete(meta.userId);
	}

	socketMeta.delete(ws);
}

export function subscribeSocketToConversation(ws: ChatSocket, conversationId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;
	meta.subscriptions.add(conversationId);
	getOrCreateSet(conversationSockets, conversationId).add(ws);
	send(ws, { type: "conversation.subscribed", conversationId });
}

export function unsubscribeSocketFromConversation(ws: ChatSocket, conversationId: string) {
	const meta = socketMeta.get(ws);
	if (!meta) return;
	meta.subscriptions.delete(conversationId);

	const sockets = conversationSockets.get(conversationId);
	if (sockets) {
		sockets.delete(ws);
		if (sockets.size === 0) conversationSockets.delete(conversationId);
	}

	send(ws, { type: "conversation.unsubscribed", conversationId });
}

export function publishConversationEvent(params: {
	conversationId: string;
	event: string;
	payload: Record<string, unknown>;
	excludeUserId?: string;
}) {
	const sockets = conversationSockets.get(params.conversationId);
	if (!sockets) return;

	for (const ws of sockets) {
		const meta = socketMeta.get(ws);
		if (!meta) continue;
		if (params.excludeUserId && meta.userId === params.excludeUserId) continue;
		send(ws, {
			type: params.event,
			conversationId: params.conversationId,
			...params.payload,
		});
	}
}

export function publishUserEvent(params: {
	userId: string;
	event: string;
	payload: Record<string, unknown>;
}) {
	const sockets = userSockets.get(params.userId);
	if (!sockets) return;

	for (const ws of sockets) {
		send(ws, { type: params.event, ...params.payload });
	}
}

export function publishUsersEvent(params: {
	userIds: string[];
	event: string;
	payload: Record<string, unknown>;
}) {
	for (const userId of params.userIds) {
		publishUserEvent({ userId, event: params.event, payload: params.payload });
	}
}
