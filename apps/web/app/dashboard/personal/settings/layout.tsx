import { SettingsSubNav } from "@/components/settings/settings-sub-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<div>
				<h1 className="text-lg font-bold">Settings</h1>
				<p className="text-xs text-muted-foreground">
					Manage your account and security preferences
				</p>
			</div>
			<SettingsSubNav />
			{children}
		</div>
	);
}
