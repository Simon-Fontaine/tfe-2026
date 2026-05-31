import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";

interface EmptyStateProps {
	icon: IconSvgElement;
	title: string;
	action?: React.ReactNode;
}

export function EmptyState({ icon, title, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
			<HugeiconsIcon
				icon={icon}
				strokeWidth={1.5}
				className="size-8 text-muted-foreground"
				aria-hidden="true"
			/>
			<p className="text-sm text-muted-foreground">{title}</p>
			{action}
		</div>
	);
}
