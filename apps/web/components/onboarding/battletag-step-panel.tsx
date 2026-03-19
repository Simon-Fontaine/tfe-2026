"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { UserCircle02Icon } from "@hugeicons/core-free-icons";
import { Controller, useForm } from "react-hook-form";

import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type BattletagInput, BattletagSchema } from "@/lib/validations/onboarding";
import { useOnboardingFlow } from "@/stores/onboarding-flow";

export function BattletagStepPanel() {
	const { transitionTo, data } = useOnboardingFlow();

	const form = useForm<BattletagInput>({
		resolver: valibotResolver(BattletagSchema),
		defaultValues: { battletag: data.battletag },
	});

	function onSubmit(values: BattletagInput) {
		transitionTo("roles-and-rank", { battletag: values.battletag });
	}

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={UserCircle02Icon}
				title="What's your BattleTag?"
				subtitle="Your Overwatch 2 BattleTag links your in-game identity to your Scrimflow profile."
			/>

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
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
				</FieldGroup>

				<Button type="submit" className="w-full">
					Continue
				</Button>
			</form>
		</div>
	);
}
