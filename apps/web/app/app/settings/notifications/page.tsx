import { NotificationPreferencesSection } from "@/components/settings/notification-preferences-section";
import { SecuritySettingsPageShell } from "@/components/settings/security-settings-page-shell";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppNotificationsSettingsPage() {
	await requireWorkspaceSession();
	const prefsRes = await apiGet<Record<string, boolean>>(
		apiRoutes.settings.notificationPreferences
	);
	const initialPreferences = "data" in prefsRes ? prefsRes.data : {};
	return (
		<SecuritySettingsPageShell>
			<NotificationPreferencesSection initialPreferences={initialPreferences} />
		</SecuritySettingsPageShell>
	);
}
