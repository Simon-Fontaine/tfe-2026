"use client";

import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
	title?: string;
}

export function PageError({ error, reset, title = "Failed to load" }: PageErrorProps) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
			<div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
				<HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-6 text-destructive" />
			</div>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{title}</h2>
				<p className="max-w-md text-sm text-muted-foreground">
					{error.message || "Something went wrong while loading this page."}
				</p>
			</div>
			<Button onClick={reset} variant="outline" size="sm">
				Try again
			</Button>
		</div>
	);
}
