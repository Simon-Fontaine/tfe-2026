"use client";

import { AuthShellLayout } from "@/components/auth/auth-shell-layout";
import { Button } from "@/components/ui/button";

export default function AuthError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<AuthShellLayout>
			<div className="space-y-4">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">Authentication error</h2>
					<p className="text-sm text-muted-foreground">
						{error.message || "We could not finish loading this authentication step. Try again."}
					</p>
				</div>
				<Button onClick={reset} variant="outline" size="sm">
					Try again
				</Button>
			</div>
		</AuthShellLayout>
	);
}
