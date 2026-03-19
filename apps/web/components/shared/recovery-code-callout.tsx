"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CodeDisplay } from "./code-display";

interface RecoveryCodeCalloutProps {
	recoveryCode: string;
	description?: string;
	className?: string;
}

export function RecoveryCodeCallout({
	recoveryCode,
	description,
	className,
}: RecoveryCodeCalloutProps) {
	return (
		<div className={`space-y-3 ${className ?? ""}`}>
			<Alert className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-600">
				<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />
				<AlertTitle>Save your recovery code</AlertTitle>
				{description && <AlertDescription>{description}</AlertDescription>}
			</Alert>
			<CodeDisplay value={recoveryCode} />
		</div>
	);
}
