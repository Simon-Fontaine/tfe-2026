import { cn } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	description?: string;
	badge?: React.ReactNode;
	actions?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
}

export function PageHeader({
	title,
	description,
	badge,
	actions,
	children,
	className,
}: PageHeaderProps) {
	return (
		<div className={cn("flex items-start justify-between gap-4", className)}>
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex items-center gap-2">
					<h1 className="text-lg font-bold">{title}</h1>
					{badge}
				</div>
				{description && <p className="text-xs text-muted-foreground">{description}</p>}
				{children}
			</div>
			{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
		</div>
	);
}
