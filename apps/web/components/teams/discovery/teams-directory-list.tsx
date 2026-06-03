"use client";

import { GameController01Icon } from "@hugeicons/core-free-icons";
import type { DiscoveryTeam } from "@scrimflow/shared";
import { useMemo, useState } from "react";
import { DirectorySearch } from "@/components/home/directory-search";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamDiscoveryCard } from "@/components/teams/discovery/team-discovery-card";

export function TeamsDirectoryList({ teams }: { teams: DiscoveryTeam[] }) {
	const [query, setQuery] = useState("");
	const normalized = query.trim().toLowerCase();

	const filtered = useMemo(() => {
		if (normalized === "") return teams;
		return teams.filter(
			(team) =>
				team.name.toLowerCase().includes(normalized) || team.tag.toLowerCase().includes(normalized)
		);
	}, [teams, normalized]);

	return (
		<div className="space-y-4">
			<DirectorySearch
				value={query}
				onChange={setQuery}
				placeholder="Search teams by name or tag"
				resultCount={filtered.length}
				noun="team"
			/>
			{filtered.length === 0 ? (
				<EmptyStateBlock
					icon={GameController01Icon}
					title="No teams match your search"
					description={`No teams matched "${query.trim()}". Try a different name or tag.`}
					variant="card"
				/>
			) : (
				<div className="divide-y border">
					{filtered.map((team) => (
						<TeamDiscoveryCard key={team.id} team={team} />
					))}
				</div>
			)}
		</div>
	);
}
