import { PrivacySettingsSection } from "@/components/settings/privacy-settings-section";
import { SecuritySettingsPageShell } from "@/components/settings/security-settings-page-shell";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppPrivacySettingsPage() {
	await requireWorkspaceSession();
	const privacyRes = await apiGet<{ profileVisibility: string }>(apiRoutes.settings.privacy);
	const profileVisibility = "data" in privacyRes ? privacyRes.data.profileVisibility : "public";
	return (
		<SecuritySettingsPageShell>
			<PrivacySettingsSection initialVisibility={profileVisibility} />
		</SecuritySettingsPageShell>
	);
}
