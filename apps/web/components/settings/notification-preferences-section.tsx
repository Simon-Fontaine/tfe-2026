"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import type {
	MandatoryNotificationPolicy,
	NotificationPreferenceSettings,
} from "@scrimflow/shared";
import { useState } from "react";
import { toast } from "sonner";
import { updateNotificationPreferencesAction } from "@/app/actions/settings/notifications";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const CATEGORIES = [
	{
		key: "invites",
		label: "Invites",
		description: "Team, organization, and channel invitations.",
	},
	{
		key: "applications",
		label: "Applications",
		description: "Recruiting applications, decisions, and withdrawals.",
	},
	{
		key: "scrimChanges",
		label: "Scrim changes",
		description: "Scrim requests, acceptances, cancellations, and reminders.",
	},
	{
		key: "chatActivity",
		label: "Chat activity",
		description: "New direct, team, recruiting, and scrim-channel messages.",
	},
	{
		key: "results",
		label: "Results",
		description: "OCR completion, result updates, and rating changes.",
	},
	{
		key: "disputes",
		label: "Disputes",
		description: "Scrim dispute openings and resolutions.",
	},
	{
		key: "updates",
		label: "Updates",
		description: "Team and organization announcements.",
	},
] as const;

const MANDATORY_CATEGORIES = [
	{
		key: "securityCritical",
		label: "Security-critical notices",
		description: "New device, new location, and session-revocation alerts remain on.",
	},
	{
		key: "accountLifecycle",
		label: "Account lifecycle notices",
		description: "Password reset, email change, deletion, and data lifecycle notices remain on.",
	},
	{
		key: "moderationCritical",
		label: "Critical moderation notices",
		description: "Required trust and policy enforcement notices remain on.",
	},
] as const;

interface NotificationPreferencesSectionProps {
	initialPreferences: NotificationPreferenceSettings;
	initialMandatoryPolicy: MandatoryNotificationPolicy;
}

export function NotificationPreferencesSection({
	initialPreferences,
	initialMandatoryPolicy,
}: NotificationPreferencesSectionProps) {
	const [prefs, setPrefs] = useState<NotificationPreferenceSettings>(initialPreferences);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
	const [formError, setFormError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string[]>>>({});

	function handleToggle(key: keyof NotificationPreferenceSettings, checked: boolean) {
		setPrefs((prev) => ({ ...prev, [key]: checked }));
	}

	async function handleSave() {
		setIsSaving(true);
		setStatus("idle");
		setFormError(null);
		setFieldErrors({});
		try {
			const result = await updateNotificationPreferencesAction(prefs);
			if (result.error) {
				setStatus("failed");
				setFormError(result.error);
				setFieldErrors(result.fieldErrors ?? {});
				toast.error(result.error);
				return;
			}
			setStatus("saved");
			toast.success("Notification preferences saved.");
		} catch {
			setStatus("failed");
			setFormError("Failed to save preferences. Please try again.");
			toast.error("Failed to save preferences. Please try again.");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<SettingsSectionCard
			icon={Notification01Icon}
			title="Notification Preferences"
			description="Choose which email notifications you want to receive."
		>
			<div className="space-y-0">
				{CATEGORIES.map((cat, index) => {
					const fieldError = fieldErrors[cat.key]?.[0];
					return (
						<div key={cat.key}>
							{index > 0 && <Separator />}
							<div className="flex items-start justify-between gap-4 py-4">
								<div className="flex-1">
									<p className="text-sm font-medium">{cat.label}</p>
									<p className="text-muted-foreground text-sm">{cat.description}</p>
								</div>
								<Switch
									checked={prefs[cat.key] ?? true}
									onCheckedChange={(checked) => handleToggle(cat.key, checked)}
									aria-label={`Toggle ${cat.label} notifications`}
								/>
							</div>
							{fieldError && <p className="pb-3 text-sm text-destructive">{fieldError}</p>}
						</div>
					);
				})}
			</div>
			<div className="mt-6 rounded-lg border bg-muted/30">
				<div className="border-b px-4 py-3">
					<p className="text-sm font-medium">Mandatory notices</p>
					<p className="text-muted-foreground text-sm">
						These are policy and security events, so they are always delivered.
					</p>
				</div>
				<div>
					{MANDATORY_CATEGORIES.map((cat, index) => (
						<div key={cat.key}>
							{index > 0 && <Separator />}
							<div className="flex items-start justify-between gap-4 px-4 py-4">
								<div className="flex-1">
									<p className="text-sm font-medium">{cat.label}</p>
									<p className="text-muted-foreground text-sm">{cat.description}</p>
								</div>
								<Switch
									checked={initialMandatoryPolicy[cat.key]}
									disabled
									aria-label={`${cat.label} are mandatory`}
								/>
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="mt-2">
				<Button onClick={handleSave} disabled={isSaving}>
					{isSaving ? "Saving..." : "Save notification preferences"}
				</Button>
				{status === "saved" && (
					<p className="mt-2 text-sm text-muted-foreground">Notification preferences saved.</p>
				)}
				{status === "failed" && formError && (
					<p className="mt-2 text-sm text-destructive">{formError}</p>
				)}
			</div>
		</SettingsSectionCard>
	);
}
