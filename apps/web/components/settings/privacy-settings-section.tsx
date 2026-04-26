"use client";

import { DatabaseExportIcon, LockIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
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
	initialVisibility: string;
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

export function PrivacySettingsSection({ initialVisibility }: PrivacySettingsSectionProps) {
	const [visibility, setVisibility] = useState(initialVisibility);
	const [isSaving, setIsSaving] = useState(false);
	const [isExporting, setIsExporting] = useState(false);

	async function handleSaveVisibility() {
		setIsSaving(true);
		try {
			const response = await fetch(apiRoutes.settings.privacy, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ profileVisibility: visibility }),
			});
			if (!response.ok) throw new Error("save failed");
			toast.success("Profile visibility updated.");
		} catch {
			toast.error("Failed to update visibility. Please try again.");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleExport() {
		setIsExporting(true);
		try {
			const response = await fetch(apiRoutes.settings.dataExport, {
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
				title="Profile Visibility"
				description="Control who can find and view your player profile on ScrimFlow."
			>
				<div className="space-y-3">
					{VISIBILITY_OPTIONS.map((option) => (
						<label
							key={option.value}
							className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/40"
						>
							<input
								type="radio"
								name="profile-visibility"
								value={option.value}
								checked={visibility === option.value}
								onChange={() => setVisibility(option.value)}
								className="mt-0.5 accent-foreground"
							/>
							<div>
								<p className="text-sm font-medium">{option.label}</p>
								<p className="text-muted-foreground text-sm">{option.description}</p>
							</div>
						</label>
					))}
				</div>
				<div className="mt-4">
					<Button onClick={handleSaveVisibility} disabled={isSaving}>
						{isSaving ? "Saving…" : "Save visibility"}
					</Button>
				</div>
			</SettingsSectionCard>

			<SettingsSectionCard
				icon={DatabaseExportIcon}
				title="Data Export"
				description="Download a copy of all your ScrimFlow account data, including profile, teams, and scrim history."
			>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="outline">Request data export</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Export your data?</AlertDialogTitle>
							<AlertDialogDescription>
								Your account data will be compiled and downloaded as a JSON file.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={handleExport} disabled={isExporting}>
								{isExporting ? "Downloading…" : "Download"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</SettingsSectionCard>
		</>
	);
}
