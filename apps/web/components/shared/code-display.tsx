"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

interface CodeDisplayProps {
	value: string;
}

export function CodeDisplay({ value }: CodeDisplayProps) {
	const [copied, setCopied] = useState(false);

	const copy = useCallback(async () => {
		await navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [value]);

	return (
		<div className="flex items-center justify-center gap-3 border bg-muted px-4 py-3 overflow-x-auto">
			<code className="font-mono text-xs font-bold tracking-widest break-all sm:text-sm sm:break-normal sm:whitespace-nowrap">
				{value}
			</code>
			<Button type="button" variant="ghost" size="icon" onClick={copy}>
				{copied ? (
					<HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
				) : (
					<HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-4" />
				)}
				<span className="sr-only">Copy</span>
			</Button>
		</div>
	);
}
