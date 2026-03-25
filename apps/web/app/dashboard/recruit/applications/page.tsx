import { File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";

export default function ApplicationsPage() {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard/recruit"
				icon={File01Icon}
				title="Applications"
				subtitle="Manage your inbound and outbound recruit applications."
			/>
			<div className="flex flex-col items-center justify-center border border-dashed px-6 py-16 text-center">
				<HugeiconsIcon
					icon={File01Icon}
					strokeWidth={1.5}
					className="mb-4 size-10 text-muted-foreground/40"
				/>
				<p className="text-sm font-medium">No applications found</p>
				<p className="mt-1 text-xs text-muted-foreground">You have not applied to any teams yet.</p>
			</div>
		</div>
	);
}
