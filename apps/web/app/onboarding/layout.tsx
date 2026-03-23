import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OnboardingShellLayout } from "@/components/onboarding/onboarding-shell-layout";
import { apiGet } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");
	if (user.registered2FA && !session.twoFactorVerified) redirect("/auth");

	const profileRes = await apiGet<{ exists: boolean }>("/api/profile/exists");
	if ("data" in profileRes && profileRes.data.exists) redirect("/dashboard");

	return <OnboardingShellLayout>{children}</OnboardingShellLayout>;
}
