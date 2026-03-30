"use client";

export default function GlobalError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body className="flex min-h-screen items-center justify-center bg-background text-foreground antialiased">
				<div className="text-center">
					<h1 className="text-2xl font-bold">Something went wrong</h1>
					<p className="mt-2 text-muted-foreground">An unexpected error occurred.</p>
					<button
						type="button"
						onClick={reset}
						className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
