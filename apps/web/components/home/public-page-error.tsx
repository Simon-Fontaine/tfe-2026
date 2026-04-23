"use client";

import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { PublicPageShell } from "./public-page-shell";

interface PublicPageErrorProps {
	error: Error & { digest?: string };
	reset?: () => void;
	retry?: () => void;
	title?: string;
	description?: string;
}

export function PublicPageError({
	error,
	reset,
	retry,
	title = "Failed to load page",
	description = "Try loading this page again. If the problem continues, come back in a moment.",
}: PublicPageErrorProps) {
	const action = retry ?? reset;

	return (
		<PublicPageShell title={title} description={description} maxWidth="4xl">
			<div className="flex flex-col items-start gap-4 border p-6 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3">
					<div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
						<HugeiconsIcon
							icon={AlertCircleIcon}
							strokeWidth={2}
							className="size-5 text-destructive"
						/>
					</div>
					<div className="space-y-1">
						<p className="text-sm font-semibold">Something went wrong.</p>
						<p className="max-w-[60ch] text-xs text-muted-foreground">
							{error.message || "The page could not be rendered right now."}
						</p>
					</div>
				</div>
				{action ? (
					<Button onClick={action} variant="outline" size="sm">
						Try again
					</Button>
				) : null}
			</div>
		</PublicPageShell>
	);
}
