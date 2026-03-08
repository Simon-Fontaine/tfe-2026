import { Settings01Icon } from "@hugeicons/core-free-icons";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
import { SettingsSubNav } from "@/components/settings/settings-sub-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={Settings01Icon}
				title="Settings"
				subtitle="Manage your account and security preferences"
			/>
			<SettingsSubNav />
			{children}
		</div>
	);
}
