import { cn } from "@/lib/utils";

interface PageSectionProps {
	title?: string;
	description?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

export function PageSection({ title, actions, children, className }: PageSectionProps) {
	return (
		<section className={cn("space-y-4", className)}>
			{(title || actions) && (
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						{title && <h2 className="text-lg font-semibold border-b pb-2 mb-4">{title}</h2>}
					</div>
					{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
				</div>
			)}
			{children}
		</section>
	);
}
