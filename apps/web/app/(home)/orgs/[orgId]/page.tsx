import { ArrowRight01Icon, GameController01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestJoinOrgDialog } from "@/components/orgs/request-join-org-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicOrgByIdOrSlug, getUserOrgRole } from "@/lib/data/organization";

export default async function OrgProfilePage({ params }: { params: Promise<{ orgId: string }> }) {
	const { orgId } = await params;
	const org = await getPublicOrgByIdOrSlug(orgId);
	if (!org) notFound();

	const { user } = await getCurrentSession();
	const userOrgRole = user ? await getUserOrgRole(org.id, user.id).catch(() => null) : null;
	const isMember = userOrgRole !== null;

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
			<div className="border p-5">
				<div className="flex items-start gap-4">
					<Avatar className="size-14 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-sm font-bold">
							{org.name.substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<h1 className="text-lg font-bold sm:text-xl">{org.name}</h1>
						<p className="text-xs text-muted-foreground">/{org.slug}</p>
						{org.description && (
							<p className="mt-2 text-sm text-muted-foreground">{org.description}</p>
						)}
						<p className="mt-2 text-xs text-muted-foreground">
							{org.teamCount} team{org.teamCount === 1 ? "" : "s"} · {org.activeRosterCount} active
							players
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				{user && !isMember && !org.hasPendingJoinRequest && (
					<RequestJoinOrgDialog orgId={org.id}>
						<Button size="sm">Request to join</Button>
					</RequestJoinOrgDialog>
				)}
				{user && !isMember && org.hasPendingJoinRequest && (
					<Button size="sm" disabled>
						Request pending
					</Button>
				)}
				{isMember && (
					<Button asChild size="sm" variant="outline">
						<Link href={`/dashboard/workspace/orgs/${org.id}`}>Open workspace</Link>
					</Button>
				)}
			</div>

			<div className="space-y-3">
				<h2 className="text-sm font-semibold">Teams</h2>
				{org.teams.length === 0 ? (
					<p className="text-xs text-muted-foreground">No public teams yet.</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{org.teams.map((team) => (
							<Link
								key={team.id}
								href={`/teams/${team.id}`}
								className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
							>
								<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
									<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
									<AvatarFallback className="rounded-none text-xs font-bold">
										{team.tag}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{team.name}</p>
									<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
										<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
										SR {team.teamSr}
									</p>
								</div>
								{team.isRecruiting && (
									<Badge variant="secondary" className="text-[10px]">
										Recruiting
									</Badge>
								)}
								<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
