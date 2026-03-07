"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Add01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
	addAvailabilityAction,
	deleteAvailabilityAction,
} from "@/app/dashboard/profile/actions/availability";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { AvailabilityRow } from "@/lib/data/player";
import { cn } from "@/lib/utils";
import { type AvailabilityInput, AvailabilitySchema } from "@/lib/validations/profile";

// ─── Static data ─────────────────────────────────────────────────────────────

const DAYS = [
	{ value: 1, label: "Mon" },
	{ value: 2, label: "Tue" },
	{ value: 3, label: "Wed" },
	{ value: 4, label: "Thu" },
	{ value: 5, label: "Fri" },
	{ value: 6, label: "Sat" },
	{ value: 0, label: "Sun" },
];

const COMMON_TIMEZONES = [
	"UTC",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Phoenix",
	"America/Anchorage",
	"Pacific/Honolulu",
	"America/Toronto",
	"America/Vancouver",
	"America/Sao_Paulo",
	"America/Argentina/Buenos_Aires",
	"America/Mexico_City",
	"Europe/London",
	"Europe/Dublin",
	"Europe/Lisbon",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Rome",
	"Europe/Madrid",
	"Europe/Amsterdam",
	"Europe/Brussels",
	"Europe/Zurich",
	"Europe/Stockholm",
	"Europe/Oslo",
	"Europe/Warsaw",
	"Europe/Prague",
	"Europe/Budapest",
	"Europe/Vienna",
	"Europe/Copenhagen",
	"Europe/Helsinki",
	"Europe/Athens",
	"Europe/Bucharest",
	"Europe/Moscow",
	"Europe/Istanbul",
	"Europe/Kyiv",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Karachi",
	"Asia/Dhaka",
	"Asia/Bangkok",
	"Asia/Singapore",
	"Asia/Hong_Kong",
	"Asia/Shanghai",
	"Asia/Tokyo",
	"Asia/Seoul",
	"Australia/Perth",
	"Australia/Brisbane",
	"Australia/Sydney",
	"Australia/Melbourne",
	"Pacific/Auckland",
	"Pacific/Fiji",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatWindowTitle(row: AvailabilityRow): string {
	if (row.dayOfWeek !== null && row.dayOfWeek !== undefined) {
		const day = DAYS.find((d) => d.value === row.dayOfWeek);
		return day ? day.label : `Day ${row.dayOfWeek}`;
	}
	if (row.specificDate) {
		return new Date(row.specificDate).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
	return "Window";
}

// ─── Delete row ──────────────────────────────────────────────────────────────

function DeleteButton({ id }: { id: string }) {
	const { formAction, isPending } = useFormAction(deleteAvailabilityAction);

	return (
		<form
			action={formAction}
			onSubmit={(e) => {
				e.preventDefault();
				const fd = new FormData(e.currentTarget);
				fd.set("id", id);
				formAction(fd);
			}}
		>
			<input type="hidden" name="id" value={id} />
			<Button
				type="submit"
				variant="ghost"
				size="icon"
				className="size-7 text-muted-foreground hover:text-destructive"
				disabled={isPending}
			>
				{isPending ? (
					<Spinner className="size-3" />
				) : (
					<HugeiconsIcon icon={Delete01Icon} strokeWidth={2} className="size-3.5" />
				)}
			</Button>
		</form>
	);
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddAvailabilityForm({ onClose }: { onClose: () => void }) {
	const { submit, isPending } = useFormAction(addAvailabilityAction, {
		loadingMessage: "Adding window…",
		successMessage: "Availability window added",
	});

	const form = useForm<AvailabilityInput>({
		resolver: valibotResolver(AvailabilitySchema),
		defaultValues: {
			type: "recurring",
			dayOfWeek: null,
			specificDate: null,
			startTime: "18:00",
			endTime: "21:00",
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
			label: "",
		},
	});

	const watchedType = form.watch("type");

	function onSubmit(values: AvailabilityInput) {
		const formData = new FormData();
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
		form.reset();
		onClose();
	}

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-lg border p-4">
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
										"flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
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

			{/* Day or date */}
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
											onClick={() => field.onChange(field.value === day.value ? null : day.value)}
											className={cn(
												"flex-1 rounded-md border border-border py-1.5 text-[10px] font-medium transition-colors hover:bg-muted",
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
				<Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
					Cancel
				</Button>
			</div>
		</form>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AvailabilitySectionProps {
	availability: AvailabilityRow[];
}

export function AvailabilitySection({ availability }: AvailabilitySectionProps) {
	const [showForm, setShowForm] = useState(false);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">Availability</CardTitle>
					{!showForm && (
						<Button
							variant="outline"
							size="sm"
							className="h-7 gap-1.5 px-2 text-xs"
							onClick={() => setShowForm(true)}
						>
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
							Add window
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Existing windows */}
				{availability.length > 0 ? (
					<div className="space-y-2">
						{availability.map((row) => (
							<div
								key={row.id}
								className="flex items-center justify-between rounded-lg border px-3 py-2"
							>
								<div className="min-w-0 flex-1">
									<p className="text-xs font-medium">
										{formatWindowTitle(row)}
										{row.label && (
											<span className="ml-1.5 text-muted-foreground">"{row.label}"</span>
										)}
									</p>
									<p className="text-[10px] text-muted-foreground">
										{row.startTime} – {row.endTime} · {row.timezone}
									</p>
								</div>
								<DeleteButton id={row.id} />
							</div>
						))}
					</div>
				) : (
					<p className="text-xs text-muted-foreground">No availability windows added yet.</p>
				)}

				{/* Add form */}
				{showForm && <AddAvailabilityForm onClose={() => setShowForm(false)} />}
			</CardContent>
		</Card>
	);
}
