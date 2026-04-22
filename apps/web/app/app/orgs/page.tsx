import { Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CreateOrgDialog } from "@/components/orgs/create-org-dialog";
import { OrgCard } from "@/components/orgs/org-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgsForUser } from "@/lib/data/orgs";

export default async function AppOrgsPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const orgs = await getOrgsForUser(user.id);

	return (
		<PageContainer>
			<PageHeader
				title="Organizations"
				description={
					orgs.length === 0
						? "Create an organisation to get started."
						: `${orgs.length} organisation${orgs.length === 1 ? "" : "s"}`
				}
				actions={
					<CreateOrgDialog>
						<Button size="sm">
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							Create organisation
						</Button>
					</CreateOrgDialog>
				}
			/>

			{orgs.length === 0 ? (
				<EmptyStateBlock
					icon={UserGroupIcon}
					title="No organisations yet"
					description="Create an organisation to manage teams, staff, brand assets, and recruiting from one workspace."
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
