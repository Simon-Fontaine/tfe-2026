import { notFound } from "next/navigation";

import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function OrgSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	if (!org.currentUser.canManage && !org.currentUser.canLeave && !org.currentUser.canDelete) {
		return (
			<div className="border border-dashed px-6 py-10 text-center">
				<p className="text-sm font-medium">No access</p>
				<p className="mt-1 text-xs text-muted-foreground">
					You don&apos;t have permission to manage this organisation&apos;s settings.
				</p>
			</div>
		);
	}

	return (
		<>
			<div>
				<h1 className="text-lg font-bold">Settings</h1>
				<p className="text-xs text-muted-foreground">
					Manage organisation profile, ownership, and danger zone actions.
				</p>
			</div>
			<OrgSettingsPanel org={org} />
		</>
	);
}
