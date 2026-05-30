import { cn } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	breadcrumbs?: React.ReactNode;
	action?: React.ReactNode;
	meta?: React.ReactNode;
	className?: string;
}

export function PageHeader({ title, breadcrumbs, action, meta, className }: PageHeaderProps) {
	return (
		<div className={cn("space-y-1", className)}>
			{breadcrumbs && <div className="text-sm text-muted-foreground">{breadcrumbs}</div>}
			<div className="flex items-start justify-between gap-4">
				<h1 className="text-2xl font-semibold">{title}</h1>
				{action && <div className="shrink-0">{action}</div>}
			</div>
			{meta && <div className="text-sm text-muted-foreground">{meta}</div>}
		</div>
	);
}
