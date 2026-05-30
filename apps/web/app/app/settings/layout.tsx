import { SettingsSubNav } from "@/components/settings/settings-sub-nav";
import { PageContainer } from "@/components/workspace/page-container";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<PageContainer>
			<SettingsSubNav />
			{children}
		</PageContainer>
	);
}
