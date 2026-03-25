"use client";

import { Search01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { UserSearchResult } from "@/lib/data/team";

interface UserSearchPickerProps {
	label: string;
	placeholder: string;
	query: string;
	searching: boolean;
	results: UserSearchResult[];
	selected: UserSearchResult | null;
	onQueryChange: (value: string) => void;
	onSelect: (user: UserSearchResult) => void;
	onClearSelection: () => void;
	minQueryLength?: number;
	emptyMessage?: (query: string) => string;
	renderUserMeta?: (user: UserSearchResult) => ReactNode;
}

export function UserSearchPicker({
	label,
	placeholder,
	query,
	searching,
	results,
	selected,
	onQueryChange,
	onSelect,
	onClearSelection,
	minQueryLength = 2,
	emptyMessage = (activeQuery) => `No users found matching "${activeQuery}".`,
	renderUserMeta,
}: UserSearchPickerProps) {
	return (
		<>
			<Field>
				<FieldLabel>{label}</FieldLabel>
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						strokeWidth={2}
						className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						placeholder={placeholder}
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						className="pl-8"
					/>
					{searching && (
						<Spinner className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2" />
					)}
				</div>
			</Field>

			{results.length > 0 && !selected && (
				<div className="max-h-48 divide-y overflow-y-auto border">
					{results.map((u) => {
						const userMeta = renderUserMeta?.(u);
						return (
							<button
								key={u.id}
								type="button"
								onClick={() => onSelect(u)}
								className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
							>
								<Avatar className="size-7 shrink-0 overflow-hidden rounded-none after:rounded-none">
									<AvatarImage src={u.avatarUrl ?? undefined} className="rounded-none" />
									<AvatarFallback className="rounded-none text-[10px]">
										<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0">
									<p className="truncate text-xs font-medium">{u.displayName}</p>
									{userMeta && <p className="text-[10px] text-muted-foreground">{userMeta}</p>}
								</div>
							</button>
						);
					})}
				</div>
			)}

			{query.length >= minQueryLength && !searching && results.length === 0 && !selected && (
				<p className="text-xs text-muted-foreground">{emptyMessage(query)}</p>
			)}

			{selected && (
				<div className="flex items-center gap-3 border bg-muted/40 px-3 py-2">
					<Avatar className="size-7 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={selected.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-[10px]">
							<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
						</AvatarFallback>
					</Avatar>
					<p className="flex-1 text-xs font-medium">{selected.displayName}</p>
					<button
						type="button"
						onClick={onClearSelection}
						className="text-[10px] text-muted-foreground hover:text-foreground"
					>
						Change
					</button>
				</div>
			)}
		</>
	);
}
