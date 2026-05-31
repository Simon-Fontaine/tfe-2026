import { Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateOrgDialog } from "@/components/orgs/create-org-dialog";
import { OrgCard } from "@/components/orgs/org-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { getOrgsForUser } from "@/lib/data/orgs";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppOrgsPage() {
	const { user } = await requireWorkspaceSession();

	const orgs = await getOrgsForUser(user.id);

	return (
		<PageContainer>
			<PageHeader
				title="Organizations"
				meta={
					orgs.length === 0
						? "Create an organization to get started."
						: `${orgs.length} organization${orgs.length === 1 ? "" : "s"}`
				}
				action={
					<CreateOrgDialog>
						<Button size="sm">
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							Create organization
						</Button>
					</CreateOrgDialog>
				}
			/>

			{orgs.length === 0 ? (
				<EmptyStateBlock
					icon={UserGroupIcon}
					title="No organizations yet"
					description="Create an organization to manage teams, staff, brand assets, and recruiting from one workspace."
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
