import { UserCircle02Icon } from "@hugeicons/core-free-icons";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={UserCircle02Icon}
				title="Your profile"
				subtitle="Manage your player profile, roles, hero pool and availability"
			/>
			{children}
		</div>
	);
}
