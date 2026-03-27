"use client";

import { InboxIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateBlockProps {
	icon?: IconSvgElement;
	title: string;
	description?: string;
	/** Primary action as a click handler */
	actionLabel?: string;
	onAction?: () => void;
	/** Primary action as a link */
	actionHref?: string;
	/** Optional secondary action */
	secondaryActionLabel?: string;
	onSecondaryAction?: () => void;
	/** Visual variant */
	variant?: "inline" | "card" | "page";
}

const variantClasses = {
	inline: "py-8",
	card: "rounded-lg border border-dashed p-8",
	page: "py-16",
} as const;

export function EmptyStateBlock({
	icon = InboxIcon,
	title,
	description,
	actionLabel,
	onAction,
	actionHref,
	secondaryActionLabel,
	onSecondaryAction,
	variant = "inline",
}: EmptyStateBlockProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-2 text-center text-muted-foreground",
				variantClasses[variant]
			)}
		>
			<div className="flex size-10 items-center justify-center rounded-full bg-muted">
				<HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 opacity-60" />
			</div>
			<p className="text-sm font-medium text-foreground">{title}</p>
			{description && <p className="max-w-[42ch] text-xs">{description}</p>}
			{(actionLabel || secondaryActionLabel) && (
				<div className="mt-1 flex items-center gap-2">
					{actionLabel && actionHref && (
						<Button type="button" variant="outline" size="sm" asChild>
							<Link href={actionHref}>{actionLabel}</Link>
						</Button>
					)}
					{actionLabel && onAction && !actionHref && (
						<Button type="button" variant="outline" size="sm" onClick={onAction}>
							{actionLabel}
						</Button>
					)}
					{secondaryActionLabel && onSecondaryAction && (
						<Button type="button" variant="ghost" size="sm" onClick={onSecondaryAction}>
							{secondaryActionLabel}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
