import type { UserPresenceStatus } from "@scrimflow/shared";
import { AvatarBadge } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const STATUS_DOT_CLASSES: Record<Exclude<UserPresenceStatus, "offline">, string> = {
	online: "bg-green-500",
	away: "bg-amber-500",
};

/**
 * Live presence dot rendered inside an `<Avatar>` (uses AvatarBadge positioning).
 * Renders nothing when the user is offline or status is unknown.
 */
export function PresenceDot({
	status,
	className,
}: {
	status: UserPresenceStatus | undefined;
	className?: string;
}) {
	if (!status || status === "offline") return null;
	return <AvatarBadge aria-label={status} className={cn(STATUS_DOT_CLASSES[status], className)} />;
}
