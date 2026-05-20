"use client";

import { DatabaseExportIcon, LockIcon } from "@hugeicons/core-free-icons";
import type { PersonalPrivacySettings, PrivacyVisibility } from "@scrimflow/shared";
import { useState } from "react";
import { toast } from "sonner";
import { updatePrivacySettingsAction } from "@/app/actions/settings/privacy";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiRoutes } from "@/lib/routes";

interface PrivacySettingsSectionProps {
	initialSettings: PersonalPrivacySettings;
}

const VISIBILITY_OPTIONS = [
	{
		value: "public",
		label: "Public",
		description: "Anyone can view your profile and find you in search.",
	},
	{
		value: "teams_only",
		label: "Teams only",
		description: "Only members of your teams can view your full profile.",
	},
	{
		value: "private",
		label: "Private",
		description: "Your profile is hidden from public search and discovery.",
	},
] as const;

export function PrivacySettingsSection({ initialSettings }: PrivacySettingsSectionProps) {
	const [settings, setSettings] = useState<PersonalPrivacySettings>(initialSettings);
	const [isSaving, setIsSaving] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
	const [formError, setFormError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string[]>>>({});

	function updateSetting<K extends keyof PersonalPrivacySettings>(
		key: K,
		value: PersonalPrivacySettings[K]
	) {
		setSettings((current) => ({ ...current, [key]: value }));
	}

	async function handleSavePrivacy() {
		setIsSaving(true);
		setStatus("idle");
		setFormError(null);
		setFieldErrors({});
		try {
			const result = await updatePrivacySettingsAction(settings);
			if (result.error) {
				setStatus("failed");
				setFormError(result.error);
				setFieldErrors(result.fieldErrors ?? {});
				toast.error(result.error);
				return;
			}
			setStatus("saved");
			toast.success("Privacy preferences updated.");
		} catch {
			setStatus("failed");
			setFormError("Failed to update privacy preferences. Please try again.");
			toast.error("Failed to update privacy preferences. Please try again.");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleExport() {
		setIsExporting(true);
		try {
			const response = await fetch(apiRoutes.settings.dataExport.download, {
				method: "GET",
				credentials: "include",
			});
			if (!response.ok) throw new Error("export failed");
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "scrimflow-data-export.json";
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			toast.error("Failed to export data. Please try again.");
		} finally {
			setIsExporting(false);
		}
	}

	return (
		<>
			<SettingsSectionCard
				icon={LockIcon}
				title="Privacy preferences"
				description="Control profile, recruiting, availability, and match-history visibility."
			>
				<div className="space-y-5">
					<VisibilityRadioGroup
						name="profile-visibility"
						title="Profile visibility"
						value={settings.profileVisibility}
						onChange={(value) => updateSetting("profileVisibility", value)}
						error={fieldErrors.profileVisibility?.[0]}
					/>
					<VisibilityRadioGroup
						name="availability-visibility"
						title="Availability visibility"
						value={settings.availabilityVisibility}
						onChange={(value) => updateSetting("availabilityVisibility", value)}
						error={fieldErrors.availabilityVisibility?.[0]}
					/>
					<VisibilityRadioGroup
						name="public-history-visibility"
						title="Public history visibility"
						value={settings.publicHistoryVisibility}
						onChange={(value) => updateSetting("publicHistoryVisibility", value)}
						error={fieldErrors.publicHistoryVisibility?.[0]}
					/>
					<label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/40">
						<input
							type="checkbox"
							checked={settings.recruitingDiscoverability}
							onChange={(event) =>
								updateSetting("recruitingDiscoverability", event.currentTarget.checked)
							}
							className="mt-0.5 accent-foreground"
						/>
						<div>
							<p className="text-sm font-medium">Recruiting discoverability</p>
							<p className="text-muted-foreground text-sm">
								Allow public recruiting discovery and player-owned listing visibility when your
								profile is public.
							</p>
						</div>
					</label>
					{fieldErrors.recruitingDiscoverability?.[0] && (
						<p className="text-sm text-destructive">{fieldErrors.recruitingDiscoverability[0]}</p>
					)}
				</div>
				<div className="mt-4">
					<Button onClick={handleSavePrivacy} disabled={isSaving}>
						{isSaving ? "Saving..." : "Save privacy preferences"}
					</Button>
					{status === "saved" && (
						<p className="mt-2 text-sm text-muted-foreground">Privacy preferences saved.</p>
					)}
					{status === "failed" && formError && (
						<p className="mt-2 text-sm text-destructive">{formError}</p>
					)}
				</div>
			</SettingsSectionCard>

			<SettingsSectionCard
				icon={DatabaseExportIcon}
				title="Data Export"
				description="Download a JSON copy of permitted personal account and profile data."
			>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="outline">Request data export</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Export your data?</AlertDialogTitle>
							<AlertDialogDescription>
								Your current export is generated immediately. Team, scrim, rating, evidence,
								moderation, and audit records may be retained under platform policy.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={handleExport} disabled={isExporting}>
								{isExporting ? "Downloading..." : "Download"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</SettingsSectionCard>
		</>
	);
}

function VisibilityRadioGroup({
	name,
	title,
	value,
	onChange,
	error,
}: {
	name: string;
	title: string;
	value: PrivacyVisibility;
	onChange: (value: PrivacyVisibility) => void;
	error?: string;
}) {
	return (
		<div className="space-y-2">
			<p className="text-sm font-medium">{title}</p>
			<div className="space-y-3">
				{VISIBILITY_OPTIONS.map((option) => (
					<label
						key={option.value}
						className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/40"
					>
						<input
							type="radio"
							name={name}
							value={option.value}
							checked={value === option.value}
							onChange={() => onChange(option.value)}
							className="mt-0.5 accent-foreground"
						/>
						<div>
							<p className="text-sm font-medium">{option.label}</p>
							<p className="text-muted-foreground text-sm">{option.description}</p>
						</div>
					</label>
				))}
			</div>
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
}
