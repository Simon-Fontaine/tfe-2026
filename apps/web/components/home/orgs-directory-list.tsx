"use client";

import { GameController01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type PublicOrgSummary, publicRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DirectorySearch } from "@/components/home/directory-search";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function OrgsDirectoryList({ orgs }: { orgs: PublicOrgSummary[] }) {
	const [query, setQuery] = useState("");
	const normalized = query.trim().toLowerCase();

	const filtered = useMemo(() => {
		if (normalized === "") return orgs;
		return orgs.filter(
			(org) =>
				org.name.toLowerCase().includes(normalized) || org.slug.toLowerCase().includes(normalized)
		);
	}, [orgs, normalized]);

	return (
		<div className="space-y-4">
			<DirectorySearch
				value={query}
				onChange={setQuery}
				placeholder="Search organizations by name"
				resultCount={filtered.length}
				noun="organization"
			/>
			{filtered.length === 0 ? (
				<EmptyStateBlock
					icon={UserGroupIcon}
					title="No organizations match your search"
					description={`No organizations matched "${query.trim()}". Try a different name.`}
					variant="card"
				/>
			) : (
				<div className="divide-y border">
					{filtered.map((org) => (
						<Link
							key={org.id}
							href={publicRoutes.orgs.bySlug(org.slug)}
							className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
						>
							<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-xs font-bold">
									{org.name.substring(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold">{org.name}</p>
								<div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
									<span className="flex items-center gap-1">
										<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
										{org.teamCount} team{org.teamCount === 1 ? "" : "s"}
									</span>
									<span className="flex items-center gap-1">
										<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
										{org.activeRosterCount} active
									</span>
								</div>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
