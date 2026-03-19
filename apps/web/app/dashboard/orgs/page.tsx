import { Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CreateOrgDialog } from "@/components/orgs/create-org-dialog";
import { OrgCard } from "@/components/orgs/org-card";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgsForUser } from "@/lib/data/organization";

export default async function OrgsPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const orgs = await getOrgsForUser(user.id);

	return (
		<div className="space-y-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={UserGroupIcon}
				title="Teams"
				subtitle="Manage your organisations and team rosters"
			/>
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-medium">Your organisations</p>
					<p className="text-xs text-muted-foreground">
						{orgs.length === 0
							? "Create an organisation to get started"
							: `${orgs.length} organisation${orgs.length === 1 ? "" : "s"}`}
					</p>
				</div>
				<CreateOrgDialog>
					<Button size="sm">
						<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
						New organisation
					</Button>
				</CreateOrgDialog>
			</div>

			{orgs.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed px-6 py-16 text-center">
					<HugeiconsIcon
						icon={Add01Icon}
						strokeWidth={1.5}
						className="mb-4 size-10 text-muted-foreground/40"
					/>
					<p className="text-sm font-medium">No organisations yet</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Create one to manage your teams and start scheduling scrims.
					</p>
					<CreateOrgDialog>
						<Button size="sm" className="mt-4">
							Create organisation
						</Button>
					</CreateOrgDialog>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{orgs.map((org) => (
						<OrgCard key={org.id} org={org} />
					))}
				</div>
			)}
		</div>
	);
}
