"use client";

import { Edit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlayerProfileFull } from "@/lib/data/player";
import { type OW2Rank, RANK_META, ROLE_META } from "@/lib/ow2";
import { cn } from "@/lib/utils";

function formatRank(rank: string | null, division: number | null): string {
	if (!rank) return "Unranked";
	const name = rank.charAt(0).toUpperCase() + rank.slice(1);
	return division ? `${name} ${division}` : name;
}

interface ProfileSummaryCardProps {
	profile: PlayerProfileFull;
}

export function ProfileSummaryCard({ profile }: ProfileSummaryCardProps) {
	const [roleFilter, setRoleFilter] = useState<"tank" | "damage" | "support">(profile.primaryRole);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">Player profile</CardTitle>
					<Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
						<Link href="/dashboard/profile">
							<HugeiconsIcon icon={Edit01Icon} strokeWidth={2} className="size-3" />
							Edit
						</Link>
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* BattleTag */}
				{profile.battletag && <p className="text-sm font-semibold">{profile.battletag}</p>}

				{/* Roles + rank */}
				<div className="flex flex-wrap gap-1.5">
					<Badge
						variant="outline"
						className={cn(
							"border-0 text-[10px] font-medium",
							ROLE_META[profile.primaryRole].badgeClass
						)}
					>
						{ROLE_META[profile.primaryRole].label}
					</Badge>
					{profile.secondaryRole && (
						<Badge
							variant="outline"
							className={cn(
								"border-0 text-[10px] font-medium opacity-70",
								ROLE_META[profile.secondaryRole].badgeClass
							)}
						>
							{ROLE_META[profile.secondaryRole].label}
						</Badge>
					)}
					<Badge
						variant="outline"
						className={cn(
							"text-[10px] font-medium",
							profile.rank ? RANK_META[profile.rank as OW2Rank].badgeClass : ""
						)}
					>
						{formatRank(profile.rank, profile.rankDivision)}
					</Badge>
				</div>

				{/* Hero pool */}
				{profile.heroes.length > 0 && (
					<div>
						<p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
							Hero pool
						</p>
						<Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
							<TabsList className="mb-2 h-7 w-full justify-start">
								<TabsTrigger value="tank" className="h-full text-[10px]">
									Tank
								</TabsTrigger>
								<TabsTrigger value="damage" className="h-full text-[10px]">
									DPS
								</TabsTrigger>
								<TabsTrigger value="support" className="h-full text-[10px]">
									Support
								</TabsTrigger>
							</TabsList>
							{(["tank", "damage", "support"] as const).map((role) => (
								<TabsContent key={role} value={role}>
									{profile.heroes.filter((h) => h.role === role).length > 0 ? (
										<div className="flex flex-wrap gap-1">
											{profile.heroes
												.filter((h) => h.role === role)
												.map((hero) => (
													<div
														key={hero.id}
														className="relative size-8 overflow-hidden"
														style={{ backgroundColor: `${ROLE_META[hero.role].color}22` }}
														title={hero.displayName}
													>
														{hero.imageUrl ? (
															<Image
																src={hero.imageUrl}
																alt={hero.displayName}
																fill
																unoptimized
																className="object-cover object-top"
															/>
														) : (
															<div className="flex h-full w-full items-center justify-center">
																<span className="text-[9px] font-bold text-white/40">
																	{hero.displayName[0]}
																</span>
															</div>
														)}
													</div>
												))}
										</div>
									) : (
										<p className="text-[11px] text-muted-foreground">
											No heroes added for this role.
										</p>
									)}
								</TabsContent>
							))}
						</Tabs>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
