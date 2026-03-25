"use client";

import { useEffect, useState } from "react";
import { searchUsers } from "@/lib/client/user-search";
import type { UserSearchResult } from "@/lib/data/team";

interface UseUserSearchOptions {
	excludeTeamId?: string;
	minQueryLength?: number;
	debounceMs?: number;
	onSelect?: (user: UserSearchResult) => void;
	prefillFromSelection?: (user: UserSearchResult) => void;
}

export function useUserSearch({
	excludeTeamId,
	minQueryLength = 2,
	debounceMs = 300,
	onSelect,
	prefillFromSelection,
}: UseUserSearchOptions) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<UserSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [selected, setSelected] = useState<UserSearchResult | null>(null);

	useEffect(() => {
		if (query.length < minQueryLength) {
			setResults([]);
			setSearching(false);
			return;
		}

		setSearching(true);
		const timer = setTimeout(async () => {
			try {
				const users = await searchUsers(query, { excludeTeamId });
				setResults(users);
			} finally {
				setSearching(false);
			}
		}, debounceMs);

		return () => clearTimeout(timer);
	}, [debounceMs, excludeTeamId, minQueryLength, query]);

	function updateQuery(nextQuery: string) {
		setQuery(nextQuery);
		setSelected(null);
	}

	function selectUser(user: UserSearchResult) {
		setSelected(user);
		setResults([]);
		onSelect?.(user);
		prefillFromSelection?.(user);
	}

	function clearSelection() {
		setSelected(null);
	}

	function reset() {
		setQuery("");
		setResults([]);
		setSearching(false);
		setSelected(null);
	}

	return {
		query,
		results,
		searching,
		selected,
		minQueryLength,
		updateQuery,
		selectUser,
		clearSelection,
		reset,
	};
}
