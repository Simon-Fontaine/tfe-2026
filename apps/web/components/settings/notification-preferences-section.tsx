"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { apiRoutes } from "@/lib/routes";

const CATEGORIES = [
	{
		key: "recruiting",
		label: "Recruiting",
		description: "Application updates, acceptances, and rejections for recruiting listings.",
	},
	{
		key: "scrims",
		label: "Scrims",
		description: "Scrim requests, confirmations, cancellations, and reminders.",
	},
	{
		key: "teamInvites",
		label: "Team Invites",
		description: "Invitations to join teams and responses to invites you've sent.",
	},
	{
		key: "orgInvites",
		label: "Org Invites",
		description: "Invitations to join organizations.",
	},
	{
		key: "security",
		label: "Security",
		description:
			"New device logins, session alerts, and account changes. Recommended to keep enabled.",
		warnOnDisable: true,
	},
] as const;

interface NotificationPreferencesSectionProps {
	initialPreferences: Record<string, boolean>;
}

export function NotificationPreferencesSection({
	initialPreferences,
}: NotificationPreferencesSectionProps) {
	const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
		const defaults: Record<string, boolean> = {};
		for (const cat of CATEGORIES) defaults[cat.key] = true;
		return { ...defaults, ...initialPreferences };
	});
	const [isSaving, setIsSaving] = useState(false);

	function handleToggle(key: string, checked: boolean) {
		setPrefs((prev) => ({ ...prev, [key]: checked }));
	}

	async function handleSave() {
		setIsSaving(true);
		try {
			const response = await fetch(apiRoutes.settings.notificationPreferences, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(prefs),
			});
			if (!response.ok) throw new Error("save failed");
			toast.success("Notification preferences saved.");
		} catch {
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
				{CATEGORIES.map((cat, index) => (
					<div key={cat.key}>
						{index > 0 && <Separator />}
						<div className="flex items-start justify-between gap-4 py-4">
							<div className="flex-1">
								<p className="text-sm font-medium">{cat.label}</p>
								<p className="text-muted-foreground text-sm">{cat.description}</p>
								{"warnOnDisable" in cat && cat.warnOnDisable && prefs[cat.key] === false && (
									<p className="mt-1 text-xs text-destructive">
										Disabling security notifications is not recommended. You may miss important
										account alerts.
									</p>
								)}
							</div>
							<Switch
								checked={prefs[cat.key] ?? true}
								onCheckedChange={(checked) => handleToggle(cat.key, checked)}
								aria-label={`Toggle ${cat.label} notifications`}
							/>
						</div>
					</div>
				))}
			</div>
			<div className="mt-2">
				<Button onClick={handleSave} disabled={isSaving}>
					{isSaving ? "Saving…" : "Save notification preferences"}
				</Button>
			</div>
		</SettingsSectionCard>
	);
}
