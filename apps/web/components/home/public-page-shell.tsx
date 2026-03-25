import type { ReactNode } from "react";

interface PublicPageShellProps {
	title: string;
	description: string;
	children?: ReactNode;
}

export function PublicPageShell({ title, description, children }: PublicPageShellProps) {
	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="public-page-title">
			<div className="mx-auto max-w-4xl">
				<div className="flex flex-col gap-3">
					<h1 id="public-page-title" className="text-lg font-bold leading-tight md:text-2xl">
						{title}
					</h1>
					<p className="max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
						{description}
					</p>
				</div>
				{children && <div className="mt-6">{children}</div>}
			</div>
		</section>
	);
}
