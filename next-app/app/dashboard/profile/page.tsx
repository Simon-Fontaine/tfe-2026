import { eq } from "drizzle-orm";
import { AvailabilitySection } from "@/components/profile/availability-section";
import { AvatarUploadSection } from "@/components/profile/avatar-upload-section";
import { BannerUploadSection } from "@/components/profile/banner-upload-section";
import { BasicInfoSection } from "@/components/profile/basic-info-section";
import { GameProfileSection } from "@/components/profile/game-profile-section";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveHeroes } from "@/lib/data/heroes";
import { getPlayerAvailability, getPlayerProfileFull } from "@/lib/data/player";

export default async function ProfilePage() {
	const { user } = await getCurrentSession();
	if (!user) return null; // layout guard ensures this never happens
	const userId = user.id;

	const [profile, availability, userRow, heroes] = await Promise.all([
		getPlayerProfileFull(userId),
		getPlayerAvailability(userId),
		db.query.userTable.findFirst({
			where: eq(userTable.id, userId),
			columns: {
				displayName: true,
				bio: true,
				socialLinks: true,
				avatarUrl: true,
				bannerUrl: true,
			},
		}),
		getActiveHeroes(),
	]);

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
			<AvailabilitySection availability={availability} />
		</div>
	);
}
