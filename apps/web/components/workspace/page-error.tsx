"use client";

import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

interface PageErrorProps {
	error: Error & { digest?: string };
	reset?: () => void;
	retry?: () => void;
	title?: string;
}

export function PageError({ error, reset, retry, title = "Failed to load" }: PageErrorProps) {
	const retryAction = retry ?? reset;

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
			<div className="flex size-12 items-center justify-center bg-destructive/10">
				<HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-6 text-destructive" />
			</div>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{title}</h2>
				<p className="max-w-md text-sm text-muted-foreground">
					{error.message || "Something went wrong while loading this page."}
				</p>
			</div>
			<div className="flex items-center gap-2">
				<Button asChild variant="outline" size="sm">
					<Link href={appRoutes.me}>Go Back</Link>
				</Button>
				{retryAction ? (
					<Button onClick={retryAction} variant="outline" size="sm">
						Try again
					</Button>
				) : null}
			</div>
		</div>
	);
}
