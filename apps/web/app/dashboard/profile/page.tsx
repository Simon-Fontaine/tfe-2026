import { AvatarUploadSection } from "@/components/profile/avatar-upload-section";
import { BannerUploadSection } from "@/components/profile/banner-upload-section";
import { BasicInfoSection } from "@/components/profile/basic-info-section";
import { GameProfileSection } from "@/components/profile/game-profile-section";
import { apiGet } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveHeroes } from "@/lib/data/heroes";
import { getPlayerProfileFull } from "@/lib/data/player";

type UserInfo = {
	displayName: string;
	bio: string | null;
	socialLinks: Record<string, string> | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
};

export default async function ProfilePage() {
	const { user } = await getCurrentSession();
	if (!user) return null; // layout guard ensures this never happens
	const userId = user.id;

	const [profile, userInfoRes, heroes] = await Promise.all([
		getPlayerProfileFull(userId),
		apiGet<UserInfo | null>("/api/profile/user-info"),
		getActiveHeroes(),
	]);

	const userRow = "data" in userInfoRes ? userInfoRes.data : null;

	return (
		<div className="space-y-8">
			<BannerUploadSection bannerUrl={userRow?.bannerUrl ?? null} />
			<AvatarUploadSection avatarUrl={userRow?.avatarUrl ?? null} />
			<BasicInfoSection
				displayName={userRow?.displayName ?? ""}
				bio={userRow?.bio ?? ""}
				socialLinks={userRow?.socialLinks ?? {}}
			/>
			{profile && <GameProfileSection profile={profile} heroes={heroes} />}
		</div>
	);
}
