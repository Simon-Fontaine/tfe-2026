import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PublicPageSectionProps {
	title?: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}

export function PublicPageSection({
	title,
	description,
	actions,
	children,
	className,
}: PublicPageSectionProps) {
	return (
		<section className={cn("space-y-4", className)}>
			{title || actions ? (
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						{title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
						{description ? (
							<p className="mt-1 text-xs text-muted-foreground">{description}</p>
						) : null}
					</div>
					{actions ? (
						<div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
					) : null}
				</div>
			) : null}
			{children}
		</section>
	);
}
