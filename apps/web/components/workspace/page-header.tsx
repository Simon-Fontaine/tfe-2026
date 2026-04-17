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
		<div
			className={cn(
				"flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between",
				className
			)}
		>
			<div className="min-w-0 flex-1 space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
					{badge}
				</div>
				{description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
				{children}
			</div>
			{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}
