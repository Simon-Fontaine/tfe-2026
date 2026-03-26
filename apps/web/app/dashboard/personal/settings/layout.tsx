import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsSubNav } from "@/components/settings/settings-sub-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<PageContainer>
			<PageHeader title="Settings" description="Manage your account and security preferences" />
			<SettingsSubNav />
			{children}
		</PageContainer>
	);
}
