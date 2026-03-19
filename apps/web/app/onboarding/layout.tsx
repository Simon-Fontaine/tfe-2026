import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OnboardingShellLayout } from "@/components/onboarding/onboarding-shell-layout";
import { db } from "@/db";
import { playerProfileTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");
	if (user.registered2FA && !session.twoFactorVerified) redirect("/auth");

	const profile = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: { id: true },
	});
	if (profile) redirect("/dashboard");

	return <OnboardingShellLayout>{children}</OnboardingShellLayout>;
}
