import type { PersonalPrivacySettings } from "@scrimflow/shared";
import { PrivacySettingsSection } from "@/components/settings/privacy-settings-section";
import { SecuritySettingsPageShell } from "@/components/settings/security-settings-page-shell";
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
		</SecuritySettingsPageShell>
	);
}
