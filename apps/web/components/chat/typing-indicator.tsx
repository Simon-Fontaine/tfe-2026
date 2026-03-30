"use client";

import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
	userIds: string[];
	/** Map of userId → displayName for showing names. */
	displayNames?: Record<string, string>;
	className?: string;
}

export function TypingIndicator({ userIds, displayNames, className }: TypingIndicatorProps) {
	if (userIds.length === 0) return null;

	let label: string;
	if (userIds.length === 1) {
		const name = displayNames?.[userIds[0] ?? ""] ?? "Someone";
		label = `${name} is typing…`;
	} else if (userIds.length === 2) {
		const a = displayNames?.[userIds[0] ?? ""] ?? "Someone";
		const b = displayNames?.[userIds[1] ?? ""] ?? "someone";
		label = `${a} and ${b} are typing…`;
	} else {
		label = `${userIds.length} people are typing…`;
	}

	return (
		<div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
			<span className="flex gap-0.5">
				<span className="animate-bounce [animation-delay:0ms] inline-block size-1 rounded-full bg-current" />
				<span className="animate-bounce [animation-delay:150ms] inline-block size-1 rounded-full bg-current" />
				<span className="animate-bounce [animation-delay:300ms] inline-block size-1 rounded-full bg-current" />
			</span>
			<span>{label}</span>
		</div>
	);
}
