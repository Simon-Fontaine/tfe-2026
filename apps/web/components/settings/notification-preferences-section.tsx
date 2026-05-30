"use client";

import type {
	MandatoryNotificationPolicy,
	NotificationPreferenceSettings,
} from "@scrimflow/shared";
import { useState } from "react";
import { toast } from "sonner";
import { updateNotificationPreferencesAction } from "@/app/actions/settings/notifications";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const CATEGORIES = [
	{ key: "invites", label: "Invites" },
	{ key: "applications", label: "Applications" },
	{ key: "scrimChanges", label: "Scrim changes" },
	{ key: "chatActivity", label: "Chat activity" },
	{ key: "results", label: "Results" },
	{ key: "disputes", label: "Disputes" },
	{ key: "updates", label: "Updates" },
] as const;

const MANDATORY_CATEGORIES = [
	{ key: "securityCritical", label: "Security-critical notices" },
	{ key: "accountLifecycle", label: "Account lifecycle notices" },
	{ key: "moderationCritical", label: "Critical moderation notices" },
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
		<>
			<div className="space-y-0">
				{CATEGORIES.map((cat, index) => {
					const fieldError = fieldErrors[cat.key]?.[0];
					return (
						<div key={cat.key}>
							{index > 0 && <Separator />}
							<div className="flex items-center justify-between gap-4 py-4">
								<p className="flex-1 text-sm font-medium">{cat.label}</p>
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
			<div className="mt-6 border bg-muted/30">
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
							<div className="flex items-center justify-between gap-4 px-4 py-4">
								<p className="flex-1 text-sm font-medium">{cat.label}</p>
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
		</>
	);
}
