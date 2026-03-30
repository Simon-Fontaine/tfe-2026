import { Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreateOrgDialog } from "@/components/orgs/create-org-dialog";
import { OrgCard } from "@/components/orgs/org-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgsForUser } from "@/lib/data/organization";

export default async function WorkspaceOrgsPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const orgs = await getOrgsForUser(user.id);

	return (
		<PageContainer>
			<PageHeader
				title="Organizations"
				description={
					orgs.length === 0
						? "Create an organisation to get started"
						: `${orgs.length} organisation${orgs.length === 1 ? "" : "s"}`
				}
				actions={
					<CreateOrgDialog>
						<Button size="sm">
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							New organisation
						</Button>
					</CreateOrgDialog>
				}
			/>

			{orgs.length === 0 ? (
				<EmptyStateBlock
					icon={UserGroupIcon}
					title="No organisations yet"
					description="Create one to manage your teams and start scheduling scrims."
					variant="card"
				/>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{orgs.map((org) => (
						<OrgCard key={org.id} org={org} />
					))}
				</div>
			)}
		</PageContainer>
	);
}
