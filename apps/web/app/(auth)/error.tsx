"use client";

import { Button } from "@/components/ui/button";

export default function AuthError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
			<h2 className="text-xl font-semibold">Authentication error</h2>
			<p className="max-w-md text-sm text-muted-foreground">
				{error.message || "Something went wrong. Please try again."}
			</p>
			<Button onClick={reset} variant="outline" size="sm">
				Try again
			</Button>
		</div>
	);
}
