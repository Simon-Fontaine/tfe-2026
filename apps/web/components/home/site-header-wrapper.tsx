import { Suspense } from "react";
import { SiteHeader } from "@/components/home/site-header";
import { getCurrentSession } from "@/lib/auth/session";

async function SiteHeaderWithSession() {
	const { user } = await getCurrentSession();

	const headerUser = user
		? {
				email: user.email,
				displayName: user.displayName,
				username: user.username,
				avatarUrl: user.avatarUrl,
			}
		: null;

	return <SiteHeader user={headerUser} />;
}

export function SiteHeaderWrapper() {
	return (
		<Suspense fallback={<SiteHeader user={null} />}>
			<SiteHeaderWithSession />
		</Suspense>
	);
}
