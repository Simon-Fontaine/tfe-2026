import type { UserPresence, UserPresenceStatus } from "@scrimflow/shared";
import { listConversationPeerUserIds } from "@/utils/chat";
import logger from "@/utils/logger";
import { publishUsersEvent } from "./chat-hub";

/**
 * Fan out a presence change to everyone who shares a conversation with the user.
 * The status is passed explicitly (online on connect, offline on last
 * disconnect) to avoid racing the Redis TTL write.
 */
export async function broadcastUserPresence(
	userId: string,
	status: UserPresenceStatus
): Promise<void> {
	try {
		const peerUserIds = await listConversationPeerUserIds(userId);
		if (peerUserIds.length === 0) return;

		const presence: UserPresence = {
			userId,
			status,
			lastSeenAt: status === "offline" ? new Date().toISOString() : null,
		};

		publishUsersEvent({
			userIds: peerUserIds,
			event: "presence:update",
			payload: { presence },
		});
	} catch (err) {
		logger.warn({ err, userId }, "presence-broadcast: failed to broadcast presence");
	}
}
