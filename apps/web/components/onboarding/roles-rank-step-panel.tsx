"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { ArrowLeft01Icon, Award01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type RolesAndRankInput, RolesAndRankSchema } from "@scrimflow/shared";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { updateOnboardingProgressAction } from "@/app/onboarding/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useOnboardingAction } from "@/hooks/use-onboarding-action";
import { RANKS, ROLES } from "@/lib/ow2";
import { cn } from "@/lib/utils";
import { useOnboardingFlow } from "@/stores/onboarding-flow";

export function RolesAndRankStepPanel() {
	const { transitionTo, data } = useOnboardingFlow();
	const [pendingValues, setPendingValues] = useState<RolesAndRankInput | null>(null);
	const { state, submit, isPending } = useOnboardingAction(updateOnboardingProgressAction, {
		loadingMessage: "Saving progress...",
	});

	const form = useForm<RolesAndRankInput>({
		resolver: valibotResolver(RolesAndRankSchema),
		defaultValues: {
			primaryRole: data.primaryRole ?? undefined,
			secondaryRole: data.secondaryRole,
			rank: data.rank ?? undefined,
			rankDivision: data.rankDivision,
		},
	});

	const watchedRank = form.watch("rank");
	const showDivision = !!watchedRank;

	useEffect(() => {
		if (state?.success && pendingValues) {
			transitionTo("hero-pool", {
				primaryRole: pendingValues.primaryRole,
				secondaryRole: pendingValues.secondaryRole ?? null,
				rank: pendingValues.rank ?? null,
				rankDivision: pendingValues.rank ? (pendingValues.rankDivision ?? null) : null,
			});
			setPendingValues(null);
		}
	}, [pendingValues, state, transitionTo]);

	function onSubmit(values: RolesAndRankInput) {
		const formData = new FormData();
		formData.set("currentStep", "hero-pool");
		formData.set("battletag", data.battletag);
		formData.set("primaryRole", values.primaryRole);
		if (values.secondaryRole) formData.set("secondaryRole", values.secondaryRole);
		if (values.rank) formData.set("rank", values.rank);
		if (values.rank && values.rankDivision)
			formData.set("rankDivision", String(values.rankDivision));
		for (const hero of data.heroPool) formData.append("heroPool[]", hero);
		if (data.participationIntent) formData.set("participationIntent", data.participationIntent);
		if (data.availabilityIntent) formData.set("availabilityIntent", data.availabilityIntent);
		setPendingValues(values);
		submit(formData);
	}

	return (
		<div className="space-y-5">
			<AuthPanelHeader icon={Award01Icon} title="Your role & rank" />

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
											disabled={isPending}
											onClick={() => {
												field.onChange(role.id);
												if (form.getValues("secondaryRole") === role.id) {
													form.setValue("secondaryRole", null);
												}
											}}
											className={cn(
												"flex flex-col items-center gap-0.5 border px-3 py-3 text-xs transition-colors",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

				{/* Secondary role (optional) */}
				<div className="space-y-1.5">
					<p className="text-xs font-medium text-muted-foreground">
						Secondary role <span className="font-normal text-muted-foreground/70">(optional)</span>
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
												disabled={isPending || role.id === primaryRole}
												onClick={() => field.onChange(field.value === role.id ? null : role.id)}
												className={cn(
													"flex-1 border px-3 py-2 text-xs transition-colors",
													"disabled:cursor-not-allowed disabled:opacity-40",
													"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
											disabled={isPending}
											className={cn(
												"flex-1 border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
											disabled={isPending}
											onClick={() => {
												const next = field.value === rank.id ? null : rank.id;
												field.onChange(next);
												if (next === null) {
													form.setValue("rankDivision", null);
												}
											}}
											className={cn(
												"border px-2 py-2 text-xs font-medium transition-colors hover:bg-muted",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												rank.buttonClass
											)}
										>
											{rank.label}
										</button>
									))}
									<button
										type="button"
										data-selected={field.value == null}
										disabled={isPending}
										onClick={() => {
											field.onChange(null);
											form.setValue("rankDivision", null);
										}}
										className={cn(
											"border border-border px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

				{/* Division (conditional) */}
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
												disabled={isPending}
												onClick={() => field.onChange(div)}
												className={cn(
													"flex-1 border border-border py-2 text-xs font-semibold transition-colors hover:bg-muted",
													"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

				{/* Actions */}
				{state?.error && <p className="text-xs text-destructive">{state.error}</p>}

				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => transitionTo("battletag")}
						disabled={isPending}
						className="gap-1.5"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
						Back
					</Button>
					<Button type="submit" className="flex-1" disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Continue
					</Button>
				</div>
			</form>
		</div>
	);
}
