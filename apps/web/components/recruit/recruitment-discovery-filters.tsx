"use client";

import { FilterIcon, MultiplicationSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	RANK_LABELS,
	RECRUITMENT_CATEGORY_LABELS,
	RECRUITMENT_RANK_VALUES,
	ROLE_LABELS,
} from "@/lib/recruitment";

const CATEGORY_OPTIONS = [
	{ value: "all", label: "All listings" },
	{ value: "lft", label: RECRUITMENT_CATEGORY_LABELS.lft },
	{ value: "lfp", label: RECRUITMENT_CATEGORY_LABELS.lfp },
	{ value: "lfr", label: RECRUITMENT_CATEGORY_LABELS.lfr },
	{ value: "lfs", label: RECRUITMENT_CATEGORY_LABELS.lfs },
] as const;

const ROLE_OPTIONS = [
	{ value: "any", label: "Any role" },
	{ value: "tank", label: ROLE_LABELS.tank },
	{ value: "damage", label: ROLE_LABELS.damage },
	{ value: "support", label: ROLE_LABELS.support },
] as const;

const RANK_OPTIONS = [
	{ value: "any", label: "Any rank" },
	...RECRUITMENT_RANK_VALUES.map((rank) => ({ value: rank, label: RANK_LABELS[rank] ?? rank })),
] as const;

interface RecruitmentDiscoveryFiltersProps {
	currentFilters: {
		category?: string;
		role?: string;
		rankFilter?: string;
		region?: string;
	};
	profileRank?: string | null;
	profileRole?: string | null;
}

export function RecruitmentDiscoveryFilters({
	currentFilters,
	profileRank,
	profileRole,
}: RecruitmentDiscoveryFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();

	const buildParams = useCallback(
		(overrides: Record<string, string | undefined>) => {
			const merged = { ...currentFilters, ...overrides };
			const params = new URLSearchParams();
			if (merged.category && merged.category !== "all") params.set("category", merged.category);
			if (merged.role && merged.role !== "any") params.set("role", merged.role);
			if (merged.rankFilter && merged.rankFilter !== "any")
				params.set("rankFilter", merged.rankFilter);
			if (merged.region?.trim()) params.set("region", merged.region.trim());
			return params.toString();
		},
		[currentFilters]
	);

	function navigate(overrides: Record<string, string | undefined>) {
		const qs = buildParams(overrides);
		router.push(`${pathname}${qs ? `?${qs}` : ""}`);
	}

	const activeCategory = currentFilters.category ?? "all";
	const activeRole = currentFilters.role ?? "any";
	const activeRank = currentFilters.rankFilter ?? "any";
	const activeRegion = currentFilters.region ?? "";

	const hasAnyFilter =
		(activeCategory && activeCategory !== "all") ||
		(activeRole && activeRole !== "any") ||
		(activeRank && activeRank !== "any") ||
		!!activeRegion.trim();

	const canMatchProfile =
		(profileRank && activeRank === "any") || (profileRole && activeRole === "any");

	function clearAll() {
		router.push(pathname);
	}

	function matchProfile() {
		navigate({
			rankFilter: profileRank && activeRank === "any" ? profileRank : activeRank,
			role: profileRole && activeRole === "any" ? profileRole : activeRole,
		});
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<HugeiconsIcon icon={FilterIcon} strokeWidth={2} className="size-4 text-muted-foreground" />

				{/* Category badges */}
				{CATEGORY_OPTIONS.map((opt) => (
					<button key={opt.value} type="button" onClick={() => navigate({ category: opt.value })}>
						<Badge
							variant={activeCategory === opt.value ? "default" : "outline"}
							className="cursor-pointer capitalize"
						>
							{opt.label}
						</Badge>
					</button>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{/* Role select */}
				<select
					value={activeRole}
					onChange={(e) => navigate({ role: e.target.value })}
					className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
					aria-label="Filter by role"
				>
					{ROLE_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>

				{/* Rank select */}
				<select
					value={activeRank}
					onChange={(e) => navigate({ rankFilter: e.target.value })}
					className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
					aria-label="Filter by rank"
				>
					{RANK_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>

				{/* Region input */}
				<Input
					value={activeRegion}
					onChange={(e) => {
						if (!e.target.value.trim()) navigate({ region: undefined });
					}}
					onBlur={(e) => navigate({ region: e.target.value || undefined })}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							navigate({ region: (e.target as HTMLInputElement).value || undefined });
						}
					}}
					placeholder="Region…"
					className="h-8 w-28 text-xs"
					aria-label="Filter by region"
				/>

				{canMatchProfile && (
					<Button size="sm" variant="outline" className="h-8 text-xs" onClick={matchProfile}>
						Match my profile
					</Button>
				)}

				{hasAnyFilter && (
					<Button
						size="sm"
						variant="ghost"
						className="h-8 gap-1 text-xs text-muted-foreground"
						onClick={clearAll}
					>
						<HugeiconsIcon icon={MultiplicationSignIcon} strokeWidth={2} className="size-3" />
						Clear filters
					</Button>
				)}
			</div>

			{/* Active filter badges */}
			{hasAnyFilter && (
				<div className="flex flex-wrap gap-1.5">
					{activeCategory && activeCategory !== "all" && (
						<Badge variant="secondary" className="gap-1 text-[10px]">
							{
								RECRUITMENT_CATEGORY_LABELS[
									activeCategory as keyof typeof RECRUITMENT_CATEGORY_LABELS
								]
							}
							<button
								type="button"
								onClick={() => navigate({ category: "all" })}
								aria-label="Remove category filter"
							>
								<HugeiconsIcon icon={MultiplicationSignIcon} strokeWidth={2} className="size-2.5" />
							</button>
						</Badge>
					)}
					{activeRole && activeRole !== "any" && (
						<Badge variant="secondary" className="gap-1 text-[10px]">
							{ROLE_LABELS[activeRole as keyof typeof ROLE_LABELS]}
							<button
								type="button"
								onClick={() => navigate({ role: "any" })}
								aria-label="Remove role filter"
							>
								<HugeiconsIcon icon={MultiplicationSignIcon} strokeWidth={2} className="size-2.5" />
							</button>
						</Badge>
					)}
					{activeRank && activeRank !== "any" && (
						<Badge variant="secondary" className="gap-1 text-[10px]">
							{RANK_LABELS[activeRank]}
							<button
								type="button"
								onClick={() => navigate({ rankFilter: "any" })}
								aria-label="Remove rank filter"
							>
								<HugeiconsIcon icon={MultiplicationSignIcon} strokeWidth={2} className="size-2.5" />
							</button>
						</Badge>
					)}
					{activeRegion.trim() && (
						<Badge variant="secondary" className="gap-1 text-[10px]">
							{activeRegion.trim()}
							<button
								type="button"
								onClick={() => navigate({ region: undefined })}
								aria-label="Remove region filter"
							>
								<HugeiconsIcon icon={MultiplicationSignIcon} strokeWidth={2} className="size-2.5" />
							</button>
						</Badge>
					)}
				</div>
			)}
		</div>
	);
}
