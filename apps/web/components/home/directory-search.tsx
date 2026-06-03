"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@/components/ui/input";

interface DirectorySearchProps {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	/** Number of results currently shown after filtering. */
	resultCount: number;
	/** Noun for the result count, e.g. "team" -> "3 teams". */
	noun: string;
}

export function DirectorySearch({
	value,
	onChange,
	placeholder,
	resultCount,
	noun,
}: DirectorySearchProps) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="relative w-full sm:max-w-xs">
				<HugeiconsIcon
					icon={Search01Icon}
					strokeWidth={2}
					className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					placeholder={placeholder}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="pl-8"
					aria-label={placeholder}
				/>
			</div>
			<p className="shrink-0 text-xs text-muted-foreground">
				{resultCount} {resultCount === 1 ? noun : `${noun}s`}
			</p>
		</div>
	);
}
