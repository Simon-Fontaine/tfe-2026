import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={SecurityCheckIcon}
				title="Security settings"
				subtitle="Manage your password, two-factor authentication, and active sessions"
			/>
			{children}
		</div>
	);
}
