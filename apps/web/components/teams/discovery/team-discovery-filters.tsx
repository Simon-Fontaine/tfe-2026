"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/lib/routes";

interface TeamDiscoveryFiltersProps {
	recruitingFilter: boolean | undefined;
}

export function TeamDiscoveryFilters({ recruitingFilter }: TeamDiscoveryFiltersProps) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const setFilter = useCallback(
		(recruiting: boolean | null) => {
			const params = new URLSearchParams(searchParams.toString());
			if (recruiting === null) {
				params.delete("recruiting");
			} else {
				params.set("recruiting", String(recruiting));
			}
			router.replace(
				`${publicRoutes.teams.root}${params.toString() ? `?${params.toString()}` : ""}`
			);
		},
		[router, searchParams]
	);

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-xs font-medium text-muted-foreground">Filter:</span>
			<Button
				size="sm"
				variant={recruitingFilter === undefined ? "default" : "outline"}
				className="h-7 text-xs"
				onClick={() => setFilter(null)}
			>
				All teams
			</Button>
			<Button
				size="sm"
				variant={recruitingFilter === true ? "default" : "outline"}
				className="h-7 text-xs"
				onClick={() => setFilter(true)}
			>
				Recruiting only
			</Button>
		</div>
	);
}
