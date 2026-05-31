import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const maxWidthClasses = {
	"3xl": "max-w-3xl",
	"4xl": "max-w-4xl",
	"5xl": "max-w-5xl",
	"6xl": "max-w-6xl",
} as const;

interface PublicPageShellProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	children?: ReactNode;
	maxWidth?: keyof typeof maxWidthClasses;
	className?: string;
	contentClassName?: string;
}

export function PublicPageShell({
	title,
	description,
	actions,
	children,
	maxWidth = "4xl",
	className,
	contentClassName,
}: PublicPageShellProps) {
	return (
		<section className={cn("border-b py-12 px-6", className)} aria-labelledby="public-page-title">
			<div className={cn("mx-auto", maxWidthClasses[maxWidth])}>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<h1 id="public-page-title" className="text-lg font-bold leading-tight md:text-2xl">
							{title}
						</h1>
						{description ? (
							<p className="max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
								{description}
							</p>
						) : null}
					</div>
					{actions ? (
						<div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
					) : null}
				</div>
				{children ? <div className={cn("mt-6", contentClassName)}>{children}</div> : null}
			</div>
		</section>
	);
}
