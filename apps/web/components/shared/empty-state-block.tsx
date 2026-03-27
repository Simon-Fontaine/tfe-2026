"use client";

import { InboxIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
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
	inline: "p-8",
	card: "p-8",
	page: "p-10",
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
		<Empty className={cn("border bg-background", variantClasses[variant])}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<HugeiconsIcon icon={icon} strokeWidth={2} className="opacity-60" />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description ? (
					<EmptyDescription className="max-w-[42ch]">{description}</EmptyDescription>
				) : null}
			</EmptyHeader>
			{(actionLabel || secondaryActionLabel) && (
				<EmptyContent>
					<div className="flex items-center gap-2">
						{actionLabel && actionHref && (
							<Button type="button" size="sm" asChild>
								<Link href={actionHref}>{actionLabel}</Link>
							</Button>
						)}
						{actionLabel && onAction && !actionHref && (
							<Button type="button" size="sm" onClick={onAction}>
								{actionLabel}
							</Button>
						)}
						{secondaryActionLabel && onSecondaryAction && (
							<Button type="button" variant="ghost" size="sm" onClick={onSecondaryAction}>
								{secondaryActionLabel}
							</Button>
						)}
					</div>
				</EmptyContent>
			)}
		</Empty>
	);
}
