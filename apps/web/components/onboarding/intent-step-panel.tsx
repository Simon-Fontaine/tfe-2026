"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { ArrowLeft01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type IntentInput, IntentSchema } from "@scrimflow/shared";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { createPlayerProfileAction } from "@/app/onboarding/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useOnboardingAction } from "@/hooks/use-onboarding-action";
import { cn } from "@/lib/utils";
import { useOnboardingFlow } from "@/stores/onboarding-flow";

const PARTICIPATION_OPTIONS = [
	{
		id: "find_team",
		label: "Find a team",
		description: "Make my profile useful for recruiting.",
	},
	{
		id: "recruit_players",
		label: "Recruit players",
		description: "Help me evaluate people for a roster.",
	},
	{
		id: "schedule_scrims",
		label: "Schedule scrims",
		description: "Prepare me for calendar and match workflows.",
	},
	{
		id: "just_browsing",
		label: "Just browsing",
		description: "Let me explore before joining a workflow.",
	},
] as const;

const AVAILABILITY_OPTIONS = [
	{ id: "weekdays", label: "Weekdays", description: "Mostly weekday evenings." },
	{ id: "weekends", label: "Weekends", description: "Mostly weekend blocks." },
	{ id: "flexible", label: "Flexible", description: "I can adapt around team needs." },
	{ id: "not_sure", label: "Not sure", description: "I will set detailed times later." },
] as const;

interface IntentStepPanelProps {
	nextDestination?: string | null;
}

export function IntentStepPanel({ nextDestination }: IntentStepPanelProps) {
	const { transitionTo, data } = useOnboardingFlow();
	const [setupError, setSetupError] = useState<string | null>(null);
	const { state, submit, isPending } = useOnboardingAction(createPlayerProfileAction, {
		loadingMessage: "Setting up your profile...",
		successMessage: "Profile ready",
	});

	const form = useForm<IntentInput>({
		resolver: valibotResolver(IntentSchema),
		defaultValues: {
			participationIntent: data.participationIntent ?? undefined,
			availabilityIntent: data.availabilityIntent ?? undefined,
		},
	});

	function onSubmit(values: IntentInput) {
		setSetupError(null);
		if (!data.battletag) {
			setSetupError("BattleTag is missing. Return to the first step and save it again.");
			transitionTo("battletag");
			return;
		}
		if (!data.primaryRole) {
			setSetupError("Primary role is missing. Return to role setup and save it again.");
			transitionTo("roles-and-rank");
			return;
		}
		if (data.heroPool.length === 0) {
			setSetupError("Hero pool is missing. Return to hero selection and save it again.");
			transitionTo("hero-pool");
			return;
		}

		const formData = new FormData();
		formData.set("battletag", data.battletag);
		formData.set("primaryRole", data.primaryRole);
		if (data.secondaryRole) formData.set("secondaryRole", data.secondaryRole);
		if (data.rank) formData.set("rank", data.rank);
		if (data.rankDivision !== null && data.rankDivision !== undefined) {
			formData.set("rankDivision", String(data.rankDivision));
		}
		for (const hero of data.heroPool) formData.append("heroPool[]", hero);
		formData.set("participationIntent", values.participationIntent);
		formData.set("availabilityIntent", values.availabilityIntent);
		if (nextDestination) formData.set("next", nextDestination);

		submit(formData);
	}

	return (
		<div className="space-y-5">
			<AuthPanelHeader
				icon={Calendar03Icon}
				title="How will you use Scrimflow?"
				subtitle="This shapes recruiting and scheduling defaults without creating team-specific availability yet."
			/>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
				<div className="space-y-1.5">
					<p className="text-xs font-medium">
						Participation intent <span className="text-destructive">*</span>
					</p>
					<Controller
						name="participationIntent"
						control={form.control}
						render={({ field, fieldState }) => (
							<>
								<div className="grid gap-2 sm:grid-cols-2">
									{PARTICIPATION_OPTIONS.map((option) => (
										<button
											key={option.id}
											type="button"
											data-selected={field.value === option.id}
											disabled={isPending}
											onClick={() => field.onChange(option.id)}
											className={cn(
												"border border-border p-3 text-left transition-colors hover:bg-muted",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
											)}
										>
											<span className="block text-sm font-semibold">{option.label}</span>
											<span className="block text-xs text-muted-foreground">
												{option.description}
											</span>
										</button>
									))}
								</div>
								<FieldError
									errors={[
										fieldState.error,
										...(state?.fieldErrors?.participationIntent ?? []).map((message) => ({
											message,
										})),
									]}
								/>
							</>
						)}
					/>
				</div>

				<div className="space-y-1.5">
					<p className="text-xs font-medium">
						Availability <span className="text-destructive">*</span>
					</p>
					<Controller
						name="availabilityIntent"
						control={form.control}
						render={({ field, fieldState }) => (
							<>
								<div className="grid gap-2 sm:grid-cols-2">
									{AVAILABILITY_OPTIONS.map((option) => (
										<button
											key={option.id}
											type="button"
											data-selected={field.value === option.id}
											disabled={isPending}
											onClick={() => field.onChange(option.id)}
											className={cn(
												"border border-border p-3 text-left transition-colors hover:bg-muted",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
											)}
										>
											<span className="block text-sm font-semibold">{option.label}</span>
											<span className="block text-xs text-muted-foreground">
												{option.description}
											</span>
										</button>
									))}
								</div>
								<FieldError
									errors={[
										fieldState.error,
										...(state?.fieldErrors?.availabilityIntent ?? []).map((message) => ({
											message,
										})),
									]}
								/>
							</>
						)}
					/>
				</div>

				{state?.error && <p className="text-xs text-destructive">{state.error}</p>}
				{setupError && <p className="text-xs text-destructive">{setupError}</p>}
				{state?.fieldErrors &&
					Object.entries(state.fieldErrors)
						.filter(([field]) => field !== "participationIntent" && field !== "availabilityIntent")
						.flatMap(([, messages]) => messages ?? [])
						.map((message) => (
							<p key={message} className="text-xs text-destructive">
								{message}
							</p>
						))}

				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => transitionTo("hero-pool")}
						disabled={isPending}
						className="gap-1.5"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
						Back
					</Button>
					<Button type="submit" className="flex-1" disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Finish setup
					</Button>
				</div>
			</form>
		</div>
	);
}
