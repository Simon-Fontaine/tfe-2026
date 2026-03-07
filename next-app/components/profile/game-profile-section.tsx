"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { updateGameProfileAction } from "@/app/dashboard/profile/actions/update-game-profile";
import { HeroPoolPicker } from "@/components/shared/hero-pool-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { HeroRow } from "@/lib/data/heroes";
import type { PlayerProfileFull } from "@/lib/data/player";
import { RANKS, ROLES } from "@/lib/ow2";
import { cn } from "@/lib/utils";
import { type UpdateGameProfileInput, UpdateGameProfileSchema } from "@/lib/validations/profile";

// ─── Component ────────────────────────────────────────────────────────────────

interface GameProfileSectionProps {
	profile: PlayerProfileFull;
	heroes: HeroRow[];
}

export function GameProfileSection({ profile, heroes }: GameProfileSectionProps) {
	const [selectedHeroes, setSelectedHeroes] = useState<Set<string>>(
		new Set(profile.heroes.map((h) => h.id))
	);
	const [heroError, setHeroError] = useState<string | null>(null);

	const { submit, isPending } = useFormAction(updateGameProfileAction, {
		loadingMessage: "Saving game profile…",
		successMessage: "Game profile updated",
	});

	const form = useForm<UpdateGameProfileInput>({
		resolver: valibotResolver(UpdateGameProfileSchema),
		defaultValues: {
			battletag: profile.battletag ?? "",
			primaryRole: profile.primaryRole,
			secondaryRole: profile.secondaryRole ?? null,
			rank: (profile.rank as UpdateGameProfileInput["rank"]) ?? null,
			rankDivision: profile.rankDivision ?? null,
			heroPool: profile.heroes.map((h) => h.id),
		},
	});

	const watchedRank = form.watch("rank");
	const showDivision = !!watchedRank;

	function toggleHero(heroId: string) {
		setHeroError(null);
		setSelectedHeroes((prev) => {
			const next = new Set(prev);
			if (next.has(heroId)) next.delete(heroId);
			else next.add(heroId);
			return next;
		});
	}

	function onSubmit(values: UpdateGameProfileInput) {
		if (selectedHeroes.size === 0) {
			setHeroError("Please select at least one hero");
			return;
		}

		const formData = new FormData();
		if (values.battletag) formData.set("battletag", values.battletag);
		formData.set("primaryRole", values.primaryRole);
		if (values.secondaryRole) formData.set("secondaryRole", values.secondaryRole);
		if (values.rank) formData.set("rank", values.rank);
		if (values.rankDivision !== null && values.rankDivision !== undefined) {
			formData.set("rankDivision", String(values.rankDivision));
		}
		for (const hero of selectedHeroes) formData.append("heroPool[]", hero);

		submit(formData);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm">Game profile</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
					{/* BattleTag */}
					<Field>
						<p className="text-xs font-medium text-muted-foreground">
							BattleTag <span className="font-normal text-muted-foreground/70">(optional)</span>
						</p>
						<Input placeholder="Soldier76#1234" {...form.register("battletag")} />
						<FieldError errors={[form.formState.errors.battletag]} />
					</Field>

					{/* Primary role */}
					<div className="space-y-1.5">
						<p className="text-xs font-medium">
							Primary role <span className="text-destructive">*</span>
						</p>
						<Controller
							name="primaryRole"
							control={form.control}
							render={({ field, fieldState }) => (
								<>
									<div className="grid grid-cols-3 gap-2">
										{ROLES.map((role) => (
											<button
												key={role.id}
												type="button"
												data-selected={field.value === role.id}
												onClick={() => {
													field.onChange(role.id);
													if (form.getValues("secondaryRole") === role.id) {
														form.setValue("secondaryRole", null);
													}
												}}
												className={cn(
													"flex flex-col items-center gap-0.5 border px-3 py-3 text-xs transition-colors",
													role.buttonClass
												)}
											>
												<span className="font-semibold">{role.label}</span>
												<span className="text-muted-foreground">{role.description}</span>
											</button>
										))}
									</div>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</>
							)}
						/>
					</div>

					{/* Secondary role */}
					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground">
							Secondary role{" "}
							<span className="font-normal text-muted-foreground/70">(optional)</span>
						</p>
						<Controller
							name="secondaryRole"
							control={form.control}
							render={({ field, fieldState }) => {
								const primaryRole = form.watch("primaryRole");
								return (
									<>
										<div className="flex gap-2">
											{ROLES.map((role) => (
												<button
													key={role.id}
													type="button"
													data-selected={field.value === role.id}
													disabled={role.id === primaryRole}
													onClick={() => field.onChange(field.value === role.id ? null : role.id)}
													className={cn(
														"flex-1 border px-3 py-2 text-xs transition-colors",
														"disabled:cursor-not-allowed disabled:opacity-40",
														role.buttonClass
													)}
												>
													{role.label}
												</button>
											))}
											<button
												type="button"
												data-selected={field.value == null}
												onClick={() => field.onChange(null)}
												className={cn(
													"flex-1 border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted",
													"data-[selected=true]:bg-muted"
												)}
											>
												None
											</button>
										</div>
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</>
								);
							}}
						/>
					</div>

					{/* Rank */}
					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground">Competitive rank</p>
						<Controller
							name="rank"
							control={form.control}
							render={({ field, fieldState }) => (
								<>
									<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
										{RANKS.map((rank) => (
											<button
												key={rank.id}
												type="button"
												data-selected={field.value === rank.id}
												onClick={() => {
													const next = field.value === rank.id ? null : rank.id;
													field.onChange(next);
													if (next === null) {
														form.setValue("rankDivision", null);
													}
												}}
												className={cn(
													"border px-2 py-2 text-xs font-medium transition-colors hover:bg-muted",
													rank.buttonClass
												)}
											>
												{rank.label}
											</button>
										))}
										<button
											type="button"
											data-selected={field.value == null}
											onClick={() => {
												field.onChange(null);
												form.setValue("rankDivision", null);
											}}
											className={cn(
												"border border-border px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted",
												"data-[selected=true]:bg-muted"
											)}
										>
											Unranked
										</button>
									</div>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</>
							)}
						/>
					</div>

					{/* Division */}
					{showDivision && (
						<div className="space-y-1.5">
							<p className="text-xs font-medium text-muted-foreground">
								Division <span className="font-normal text-muted-foreground/70">(1 = highest)</span>
							</p>
							<Controller
								name="rankDivision"
								control={form.control}
								render={({ field, fieldState }) => (
									<>
										<div className="flex gap-2">
											{[1, 2, 3, 4, 5].map((div) => (
												<button
													key={div}
													type="button"
													data-selected={field.value === div}
													onClick={() => field.onChange(div)}
													className={cn(
														"flex-1 border border-border py-2 text-xs font-semibold transition-colors hover:bg-muted",
														"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
													)}
												>
													{div}
												</button>
											))}
										</div>
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</>
								)}
							/>
						</div>
					)}

					{/* Hero pool */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<p className="text-xs font-medium">Hero pool</p>
							{selectedHeroes.size > 0 && (
								<span className="text-[10px] text-muted-foreground">
									{selectedHeroes.size} selected
								</span>
							)}
						</div>

						<HeroPoolPicker
							heroes={heroes}
							selectedHeroes={selectedHeroes}
							onToggle={toggleHero}
							disabled={isPending}
							maxHeight="max-h-[320px]"
							gridCols="grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
						/>

						{heroError && <p className="text-xs text-destructive">{heroError}</p>}
					</div>

					<Button type="submit" size="sm" disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Save changes
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
