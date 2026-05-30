import type {
	MandatoryNotificationPolicy,
	NotificationPreferenceSettings,
} from "@scrimflow/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationPreferencesSection } from "@/components/settings/notification-preferences-section";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppNotificationsSettingsPage() {
	await requireWorkspaceSession();
	const prefsRes = await apiGet<{
		optional: NotificationPreferenceSettings;
		mandatory: MandatoryNotificationPolicy;
	}>(apiRoutes.settings.notificationPreferences);
	const initialPreferences =
		"data" in prefsRes
			? prefsRes.data
			: ({
					optional: {
						invites: true,
						applications: true,
						scrimChanges: true,
						chatActivity: true,
						results: true,
						disputes: true,
						updates: true,
					},
					mandatory: {
						accountLifecycle: true,
						securityCritical: true,
						moderationCritical: true,
					},
				} satisfies {
					optional: NotificationPreferenceSettings;
					mandatory: MandatoryNotificationPolicy;
				});
	return (
		<>
			<PageHeader breadcrumbs="Settings / Notifications" title="Notifications" />
			<div className="space-y-6">
				<NotificationPreferencesSection
					initialMandatoryPolicy={initialPreferences.mandatory}
					initialPreferences={initialPreferences.optional}
				/>
			</div>
		</>
	);
}
