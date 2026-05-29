import { DatabaseExportIcon } from "@hugeicons/core-free-icons";
import type { PersonalPrivacySettings } from "@scrimflow/shared";
import { PrivacySettingsSection } from "@/components/settings/privacy-settings-section";
import { SecuritySettingsPageShell } from "@/components/settings/security-settings-page-shell";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppPrivacySettingsPage() {
	await requireWorkspaceSession();
	const privacyRes = await apiGet<PersonalPrivacySettings>(apiRoutes.settings.privacy);
	const privacySettings =
		"data" in privacyRes
			? privacyRes.data
			: ({
					profileVisibility: "public",
					availabilityVisibility: "public",
					recruitingDiscoverability: true,
					publicHistoryVisibility: "public",
				} satisfies PersonalPrivacySettings);
	return (
		<SecuritySettingsPageShell>
			<PrivacySettingsSection initialSettings={privacySettings} />
			<SettingsSectionCard
				icon={DatabaseExportIcon}
				title="Export your data"
				description="Download a copy of your personal data including profile, team memberships, and applications."
			>
				<a
					href={apiRoutes.settings.dataExport.download}
					download
					className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					Download a copy of your personal data (JSON).
				</a>
			</SettingsSectionCard>
		</SecuritySettingsPageShell>
	);
}
