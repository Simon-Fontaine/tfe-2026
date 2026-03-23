"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
			<h2 className="text-xl font-semibold">Failed to load</h2>
			<p className="max-w-md text-sm text-muted-foreground">
				{error.message || "Something went wrong while loading this page."}
			</p>
			<Button onClick={reset} variant="outline" size="sm">
				Try again
			</Button>
		</div>
	);
}
