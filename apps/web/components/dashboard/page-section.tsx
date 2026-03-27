import { cn } from "@/lib/utils";

interface PageSectionProps {
	title?: string;
	description?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

export function PageSection({
	title,
	description,
	actions,
	children,
	className,
}: PageSectionProps) {
	return (
		<section className={cn("space-y-3", className)}>
			{(title || actions) && (
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						{title && <h2 className="text-sm font-semibold">{title}</h2>}
						{description && <p className="text-xs text-muted-foreground">{description}</p>}
					</div>
					{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
				</div>
			)}
			{children}
		</section>
	);
}
