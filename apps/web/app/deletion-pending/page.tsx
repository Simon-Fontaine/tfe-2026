import { redirect } from "next/navigation";

import { DeletionPendingView } from "@/components/deletion-pending/deletion-pending-view";
import { apiGet } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";

export default async function DeletionPendingPage() {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");

	const res = await apiGet<{ isPending: boolean; scheduledAt: string | null }>(
		"/api/settings/account/deletion"
	);
	if (!("data" in res) || !res.data.isPending || !res.data.scheduledAt) redirect("/dashboard");

	return <DeletionPendingView scheduledAt={res.data.scheduledAt} />;
}
