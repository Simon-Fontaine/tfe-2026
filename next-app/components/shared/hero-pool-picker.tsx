"use client";

import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HeroRow } from "@/lib/data/heroes";
import { cn } from "@/lib/utils";

// ─── Role styling maps ─────────────────────────────────────────────────────────

const ROLE_ACCENT: Record<HeroRow["role"], string> = {
	tank: "bg-blue-500",
	damage: "bg-orange-500",
	support: "bg-emerald-500",
};

const ROLE_FALLBACK_BG: Record<HeroRow["role"], string> = {
	tank: "bg-blue-950",
	damage: "bg-orange-950",
	support: "bg-emerald-950",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface HeroPoolPickerProps {
	/** Full list of available heroes */
	heroes: HeroRow[];
	/** Currently selected hero IDs */
	selectedHeroes: Set<string>;
	/** Called when a hero card is clicked */
	onToggle: (heroId: string) => void;
	/** Disables all cards (e.g. while a form is submitting) */
	disabled?: boolean;
	/**
	 * Tailwind max-height class for the scrollable grid container.
	 * Defaults to `"max-h-[360px]"`.
	 */
	maxHeight?: string;
	/**
	 * Tailwind grid-cols classes for the hero grid.
	 * Defaults to `"grid-cols-3 sm:grid-cols-4 md:grid-cols-5"` (onboarding-style).
	 */
	gridCols?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function HeroPoolPicker({
	heroes,
	selectedHeroes,
	onToggle,
	disabled = false,
	maxHeight = "max-h-[360px]",
	gridCols = "grid-cols-3 sm:grid-cols-4 md:grid-cols-5",
}: HeroPoolPickerProps) {
	const heroesByRole = {
		tank: heroes.filter((h) => h.role === "tank"),
		damage: heroes.filter((h) => h.role === "damage"),
		support: heroes.filter((h) => h.role === "support"),
	};

	function renderGrid(list: HeroRow[]) {
		return (
			<div className={cn("grid gap-2", gridCols)}>
				{list.map((hero) => {
					const isSelected = selectedHeroes.has(hero.id);
					return (
						<button
							key={hero.id}
							type="button"
							onClick={() => onToggle(hero.id)}
							disabled={disabled}
							aria-pressed={isSelected}
							aria-label={`${hero.displayName}${isSelected ? " (selected)" : ""}`}
							className={cn(
								"group relative aspect-[3/4] overflow-hidden border border-border transition-all duration-200",
								"hover:border-muted-foreground/60 hover:shadow-lg",
								"disabled:cursor-not-allowed disabled:opacity-50",
								ROLE_FALLBACK_BG[hero.role],
								isSelected &&
									"border-primary ring-1 ring-primary ring-offset-1 ring-offset-background"
							)}
						>
							{/* Hero portrait */}
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
									<span className="text-2xl font-bold text-white/20">{hero.displayName[0]}</span>
								</div>
							)}

							{/* Bottom gradient overlay */}
							<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

							{/* Role color accent strip */}
							<div
								className={cn("absolute bottom-0 left-0 right-0 h-[3px]", ROLE_ACCENT[hero.role])}
							/>

							{/* Hero name */}
							<div className="absolute bottom-1.5 left-0 right-0 px-1.5">
								<p className="truncate text-center text-[10px] font-semibold leading-tight text-white">
									{hero.displayName}
								</p>
							</div>

							{/* Selected overlay + checkmark */}
							{isSelected && (
								<>
									<div className="absolute inset-0 bg-primary/15" />
									<div className="absolute right-1 top-1 bg-primary p-0.5 shadow">
										<HugeiconsIcon
											icon={CheckmarkCircle01Icon}
											strokeWidth={2}
											className="size-3 text-primary-foreground"
										/>
									</div>
								</>
							)}
						</button>
					);
				})}
			</div>
		);
	}

	return (
		<Tabs defaultValue="all">
			<TabsList className="w-full">
				<TabsTrigger value="all" className="flex-1">
					All
				</TabsTrigger>
				<TabsTrigger value="tank" className="flex-1">
					Tank
				</TabsTrigger>
				<TabsTrigger value="damage" className="flex-1">
					Damage
				</TabsTrigger>
				<TabsTrigger value="support" className="flex-1">
					Support
				</TabsTrigger>
			</TabsList>

			<TabsContent value="all" className="mt-3">
				<div className={cn("overflow-y-auto pr-1", maxHeight)}>{renderGrid(heroes)}</div>
			</TabsContent>
			<TabsContent value="tank" className="mt-3">
				<div className={cn("overflow-y-auto pr-1", maxHeight)}>{renderGrid(heroesByRole.tank)}</div>
			</TabsContent>
			<TabsContent value="damage" className="mt-3">
				<div className={cn("overflow-y-auto pr-1", maxHeight)}>
					{renderGrid(heroesByRole.damage)}
				</div>
			</TabsContent>
			<TabsContent value="support" className="mt-3">
				<div className={cn("overflow-y-auto pr-1", maxHeight)}>
					{renderGrid(heroesByRole.support)}
				</div>
			</TabsContent>
		</Tabs>
	);
}
