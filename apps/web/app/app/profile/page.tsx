import { AvatarUploadSection } from "@/components/profile/avatar-upload-section";
import { BannerUploadSection } from "@/components/profile/banner-upload-section";
import { BasicInfoSection } from "@/components/profile/basic-info-section";
import { GameProfileSection } from "@/components/profile/game-profile-section";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { apiGet } from "@/lib/api-client";
import { getActiveHeroes } from "@/lib/data/heroes";
import { getPlayerProfileFull } from "@/lib/data/player";
import { apiRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

type UserInfo = {
	displayName: string;
	bio: string | null;
	socialLinks: Record<string, string> | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
};

export default async function AppProfilePage() {
	const { user } = await requireWorkspaceSession();

	const [profile, userInfoRes, heroes] = await Promise.all([
		getPlayerProfileFull(user.id),
		apiGet<UserInfo | null>(apiRoutes.profile.userInfo),
		getActiveHeroes(),
	]);

	const userRow = "data" in userInfoRes ? userInfoRes.data : null;

	return (
		<PageContainer>
			<PageHeader
				title="Your profile"
				description="Manage your player identity, public profile details, roles, and hero pool."
			/>
			<div className="space-y-8">
				<BannerUploadSection bannerUrl={userRow?.bannerUrl ?? null} />
				<AvatarUploadSection avatarUrl={userRow?.avatarUrl ?? null} />
				<BasicInfoSection
					displayName={userRow?.displayName ?? ""}
					bio={userRow?.bio ?? ""}
					socialLinks={userRow?.socialLinks ?? {}}
				/>
				{profile ? <GameProfileSection profile={profile} heroes={heroes} /> : null}
			</div>
		</PageContainer>
	);
}
