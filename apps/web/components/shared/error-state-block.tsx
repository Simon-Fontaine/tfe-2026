"use client";

import { Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorStateBlockProps {
	message?: string;
	onRetry?: () => void;
}

export function ErrorStateBlock({
	message = "Something went wrong. Please try again.",
	onRetry,
}: ErrorStateBlockProps) {
	return (
		<Alert variant="destructive">
			<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />
			<AlertDescription className="flex items-center justify-between gap-3">
				<span>{message}</span>
				{onRetry && (
					<Button type="button" size="sm" variant="outline" onClick={onRetry}>
						<HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="mr-1.5 size-3.5" />
						Retry
					</Button>
				)}
			</AlertDescription>
		</Alert>
	);
}
