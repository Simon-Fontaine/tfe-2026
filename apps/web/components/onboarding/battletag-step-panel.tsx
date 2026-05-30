"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { UserCircle02Icon } from "@hugeicons/core-free-icons";
import { type BattletagInput, BattletagSchema } from "@scrimflow/shared";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { updateOnboardingProgressAction } from "@/app/onboarding/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useOnboardingAction } from "@/hooks/use-onboarding-action";
import { useOnboardingFlow } from "@/stores/onboarding-flow";

export function BattletagStepPanel() {
	const { transitionTo, data } = useOnboardingFlow();
	const [pendingValues, setPendingValues] = useState<BattletagInput | null>(null);
	const { state, submit, isPending } = useOnboardingAction(updateOnboardingProgressAction, {
		loadingMessage: "Saving progress...",
	});

	const form = useForm<BattletagInput>({
		resolver: valibotResolver(BattletagSchema),
		defaultValues: { battletag: data.battletag },
	});

	useEffect(() => {
		if (state?.success && pendingValues) {
			transitionTo("roles-and-rank", { battletag: pendingValues.battletag });
			setPendingValues(null);
		}
	}, [pendingValues, state, transitionTo]);

	function onSubmit(values: BattletagInput) {
		const formData = new FormData();
		formData.set("currentStep", "roles-and-rank");
		formData.set("battletag", values.battletag);
		setPendingValues(values);
		submit(formData);
	}

	return (
		<div className="space-y-4">
			<AuthPanelHeader icon={UserCircle02Icon} title="What's your BattleTag?" />

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<Controller
						name="battletag"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="ob-battletag">BattleTag</FieldLabel>
								<Input
									{...field}
									id="ob-battletag"
									placeholder="Soldier76#1234"
									autoComplete="off"
									spellCheck={false}
									aria-invalid={fieldState.invalid}
									disabled={isPending}
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
				</FieldGroup>

				{state?.error && <p className="text-xs text-destructive">{state.error}</p>}

				<Button type="submit" className="w-full" disabled={isPending}>
					{isPending && <Spinner className="mr-1.5" />}
					Continue
				</Button>
			</form>
		</div>
	);
}
