import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard/me"
				icon={Calendar03Icon}
				title="Schedule"
				subtitle="Set your recurring availability and one-off dates for scrim scheduling"
			/>
			{children}
		</div>
	);
}
