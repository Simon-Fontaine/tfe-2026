import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DeletionPendingView } from "@/components/deletion-pending/deletion-pending-view";
import { db } from "@/db";
import { accountDeletionRequestTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";

export default async function DeletionPendingPage() {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");

	const record = await db.query.accountDeletionRequestTable.findFirst({
		where: and(
			eq(accountDeletionRequestTable.userId, user.id),
			isNull(accountDeletionRequestTable.cancelledAt),
			gt(accountDeletionRequestTable.scheduledDeletionAt, new Date())
		),
		columns: { scheduledDeletionAt: true },
	});
	if (!record?.scheduledDeletionAt) redirect("/dashboard");

	return <DeletionPendingView scheduledAt={record.scheduledDeletionAt.toISOString()} />;
}
