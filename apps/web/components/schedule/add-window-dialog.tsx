"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { type AvailabilityInput, AvailabilitySchema } from "@scrimflow/shared";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { addAvailabilityAction } from "@/app/actions/schedule/availability";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import { COMMON_TIMEZONES, DAYS } from "@/lib/schedule/constants";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDefaults(
	type: "recurring" | "one_off",
	day: number | null,
	teamId: string
): AvailabilityInput {
	return {
		teamId,
		type,
		dayOfWeek: day,
		specificDate: null,
		startTime: "18:00",
		endTime: "21:00",
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
		label: "",
	};
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AddWindowDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultType?: "recurring" | "one_off";
	defaultDay?: number | null;
	teamId: string;
}

export function AddWindowDialog({
	open,
	onOpenChange,
	defaultType = "recurring",
	defaultDay = null,
	teamId,
}: AddWindowDialogProps) {
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(addAvailabilityAction, {
		loadingMessage: "Adding window…",
		successMessage: "Availability window added",
	});

	const form = useForm<AvailabilityInput>({
		resolver: valibotResolver(AvailabilitySchema),
		defaultValues: buildDefaults(defaultType, defaultDay, teamId),
	});

	const watchedType = form.watch("type");

	// Reset form with correct defaults each time the dialog opens
	useEffect(() => {
		if (open) {
			form.reset(buildDefaults(defaultType, defaultDay, teamId));
		}
	}, [open, defaultType, defaultDay, teamId, form.reset]);

	// Close dialog when the action succeeds
	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			onOpenChange(false);
		}
	}, [state, onOpenChange]);

	function onSubmit(values: AvailabilityInput) {
		pendingRef.current = true;
		const formData = new FormData();
		formData.set("teamId", values.teamId);
		formData.set("type", values.type);
		if (
			values.type === "recurring" &&
			values.dayOfWeek !== null &&
			values.dayOfWeek !== undefined
		) {
			formData.set("dayOfWeek", String(values.dayOfWeek));
		}
		if (values.type === "one_off" && values.specificDate) {
			formData.set("specificDate", values.specificDate);
		}
		formData.set("startTime", values.startTime);
		formData.set("endTime", values.endTime);
		formData.set("timezone", values.timezone);
		if (values.label) formData.set("label", values.label);
		submit(formData);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add availability window</DialogTitle>
				</DialogHeader>

				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					{/* Type toggle */}
					<div className="space-y-1.5">
						<p className="text-xs font-medium">Type</p>
						<Controller
							name="type"
							control={form.control}
							render={({ field }) => (
								<div className="flex gap-2">
									{(["recurring", "one_off"] as const).map((t) => (
										<button
											key={t}
											type="button"
											data-selected={field.value === t}
											onClick={() => field.onChange(t)}
											className={cn(
												"flex-1 border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{t === "recurring" ? "Recurring" : "One-off"}
										</button>
									))}
								</div>
							)}
						/>
					</div>

					{/* Day of week or specific date */}
					{watchedType === "recurring" ? (
						<div className="space-y-1.5">
							<p className="text-xs font-medium">Day of week</p>
							<Controller
								name="dayOfWeek"
								control={form.control}
								render={({ field, fieldState }) => (
									<>
										<div className="flex gap-1">
											{DAYS.map((day) => (
												<button
													key={day.value}
													type="button"
													data-selected={field.value === day.value}
													onClick={() =>
														field.onChange(field.value === day.value ? null : day.value)
													}
													className={cn(
														"flex-1 border border-border py-1.5 text-[10px] font-medium transition-colors hover:bg-muted",
														"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
														"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
													)}
												>
													{day.label}
												</button>
											))}
										</div>
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</>
								)}
							/>
						</div>
					) : (
						<Field>
							<FieldLabel htmlFor="specificDate">Date</FieldLabel>
							<Input id="specificDate" type="date" {...form.register("specificDate")} />
							<FieldError errors={[form.formState.errors.specificDate]} />
						</Field>
					)}

					{/* Time range */}
					<div className="grid grid-cols-2 gap-3">
						<Field>
							<FieldLabel htmlFor="startTime">Start time</FieldLabel>
							<Input id="startTime" type="time" {...form.register("startTime")} />
							<FieldError errors={[form.formState.errors.startTime]} />
						</Field>
						<Field>
							<FieldLabel htmlFor="endTime">End time</FieldLabel>
							<Input id="endTime" type="time" {...form.register("endTime")} />
							<FieldError errors={[form.formState.errors.endTime]} />
						</Field>
					</div>

					{/* Timezone */}
					<Field>
						<FieldLabel htmlFor="timezone">Timezone</FieldLabel>
						<Controller
							name="timezone"
							control={form.control}
							render={({ field, fieldState }) => (
								<>
									<select
										id="timezone"
										value={field.value}
										onChange={(e) => field.onChange(e.target.value)}
										className="h-8 w-full rounded-none border border-input bg-transparent px-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
									>
										{COMMON_TIMEZONES.map((tz) => (
											<option key={tz} value={tz}>
												{tz}
											</option>
										))}
									</select>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</>
							)}
						/>
					</Field>

					{/* Label (optional) */}
					<Field>
						<FieldLabel htmlFor="label">
							Label <span className="font-normal text-muted-foreground/70">(optional)</span>
						</FieldLabel>
						<Input
							id="label"
							placeholder="e.g. Weekday evenings"
							maxLength={40}
							{...form.register("label")}
						/>
					</Field>

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Add window
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
