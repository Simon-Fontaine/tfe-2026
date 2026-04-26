import { SettingsSubNav } from "@/components/settings/settings-sub-nav";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<PageContainer>
			<PageHeader title="Settings" />
			<SettingsSubNav />
			{children}
		</PageContainer>
	);
}
