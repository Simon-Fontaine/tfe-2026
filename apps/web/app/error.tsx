"use client";

import { Button } from "@/components/ui/button";

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
			<h1 className="text-2xl font-bold">Something went wrong</h1>
			<p className="max-w-md text-muted-foreground">
				{error.message || "An unexpected error occurred. Please try again."}
			</p>
			<Button onClick={reset} variant="outline">
				Try again
			</Button>
		</div>
	);
}
