"use client";

import { InboxIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

interface EmptyStateBlockProps {
	icon?: IconSvgElement;
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
}

export function EmptyStateBlock({
	icon = InboxIcon,
	title,
	description,
	actionLabel,
	onAction,
}: EmptyStateBlockProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
			<HugeiconsIcon icon={icon} strokeWidth={2} className="size-6 opacity-50" />
			<p className="text-xs font-medium text-foreground">{title}</p>
			{description && <p className="max-w-[36ch] text-xs">{description}</p>}
			{actionLabel && onAction && (
				<Button type="button" variant="link" size="sm" onClick={onAction}>
					{actionLabel}
				</Button>
			)}
		</div>
	);
}
