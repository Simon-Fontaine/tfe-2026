import { GameController01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicOrgs } from "@/lib/data/organization";

export default async function OrgsDirectoryPage() {
	const orgs = await getPublicOrgs();

	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="orgs-heading">
			<div className="mx-auto max-w-6xl space-y-6">
				<div>
					<h1 id="orgs-heading" className="text-lg font-bold leading-tight md:text-2xl">
						Organizations
					</h1>
					<p className="mt-3 max-w-[48ch] text-xs text-muted-foreground leading-relaxed">
						Discover organizations and the teams they operate.
					</p>
				</div>

				{orgs.length === 0 ? (
					<div className="flex flex-col items-center justify-center border border-dashed p-6 py-16 text-center">
						<p className="text-sm font-bold">No public organizations yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Check back later as teams publish their workspace profile.
						</p>
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{orgs.map((org) => (
							<Link
								key={org.id}
								href={`/orgs/${org.slug}`}
								className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
							>
								<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
									<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
									<AvatarFallback className="rounded-none text-xs font-bold">
										{org.name.substring(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-semibold">{org.name}</p>
									<div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<HugeiconsIcon
												icon={GameController01Icon}
												strokeWidth={2}
												className="size-3"
											/>
											{org.teamCount} team{org.teamCount === 1 ? "" : "s"}
										</span>
										<span className="flex items-center gap-1">
											<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
											{org.activeRosterCount} active
										</span>
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
