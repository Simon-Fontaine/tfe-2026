import type { PersonalPrivacySettings } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrivacySettingsSection } from "@/components/settings/privacy-settings-section";
import { apiGet } from "@/lib/api-client";
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
		<>
			<PageHeader breadcrumbs="Settings / Privacy" title="Privacy" />
			<div className="space-y-6">
				<PrivacySettingsSection initialSettings={privacySettings} />
			</div>
		</>
	);
}
