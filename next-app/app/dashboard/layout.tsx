import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/db";
import { accountDeletionRequestTable, playerProfileTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/data/notifications";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");
	if (user.registered2FA && !session.twoFactorVerified) redirect("/auth");

	const profile = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: { id: true },
	});
	if (!profile) redirect("/onboarding");

	const pendingDeletion = await db.query.accountDeletionRequestTable.findFirst({
		where: and(
			eq(accountDeletionRequestTable.userId, user.id),
			isNull(accountDeletionRequestTable.cancelledAt),
			gt(accountDeletionRequestTable.scheduledDeletionAt, new Date())
		),
		columns: { id: true },
	});
	if (pendingDeletion) redirect("/deletion-pending");

	const unreadCount = await getUnreadNotificationCount(user.id);

	return (
		<DashboardShell user={user} unreadCount={unreadCount}>
			{children}
		</DashboardShell>
	);
}
