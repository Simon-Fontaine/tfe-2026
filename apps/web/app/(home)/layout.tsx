import type { ReactNode } from "react";
import { SiteHeader } from "@/components/home/site-header";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomeLayout({ children }: { children: ReactNode }) {
	const { user } = await getCurrentSession();

	const headerUser = user
		? {
				email: user.email,
				displayName: user.displayName,
				username: user.username,
				avatarUrl: user.avatarUrl,
			}
		: null;

	return (
		<div>
			<SiteHeader user={headerUser} />
			<main id="main-content">{children}</main>
		</div>
	);
}
