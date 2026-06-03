import Image from "next/image";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PublicProfileHeaderProps {
	name: string;
	subtitle?: ReactNode;
	avatarUrl?: string | null;
	avatarFallback: string;
	bannerUrl?: string | null;
	/** Compact muted facts line shown under the title (e.g. rating, members). */
	meta?: ReactNode;
	/** Status badges (role, rank, recruiting, etc.). */
	badges?: ReactNode;
	/** Contextual actions (workspace links, report, CTA). */
	actions?: ReactNode;
}

export function PublicProfileHeader({
	name,
	subtitle,
	avatarUrl,
	avatarFallback,
	bannerUrl,
	meta,
	badges,
	actions,
}: PublicProfileHeaderProps) {
	return (
		<header className="border">
			{bannerUrl ? (
				<div className="relative h-36 overflow-hidden border-b">
					<Image
						src={bannerUrl}
						alt=""
						fill
						sizes="(min-width: 1024px) 1024px, 100vw"
						unoptimized
						className="object-cover"
					/>
				</div>
			) : null}
			<div className="p-5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex min-w-0 flex-1 items-start gap-4">
						<Avatar className="size-14 shrink-0 overflow-hidden rounded-none after:rounded-none">
							<AvatarImage src={avatarUrl ?? undefined} className="rounded-none" />
							<AvatarFallback className="rounded-none text-sm font-bold">
								{avatarFallback}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1 space-y-2">
							<div className="min-w-0">
								<h1 className="truncate text-xl font-bold leading-tight sm:text-2xl">{name}</h1>
								{subtitle ? (
									<div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
								) : null}
							</div>
							{meta ? (
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
									{meta}
								</div>
							) : null}
							{badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
						</div>
					</div>
					{actions ? (
						<div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
					) : null}
				</div>
			</div>
		</header>
	);
}
