"use client";

import type { RecruitmentApplicationSummary } from "@scrimflow/shared";
import Link from "next/link";

import { withdrawRecruitmentApplicationAction } from "@/app/actions/recruit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";
import { appRoutes } from "@/lib/routes";

interface RecruitmentSentApplicationsPanelProps {
	applications: RecruitmentApplicationSummary[];
	conversationHrefBase?: string;
}

function SentApplicationCard({
	application,
	conversationHrefBase,
}: {
	application: RecruitmentApplicationSummary;
	conversationHrefBase?: string;
}) {
	const { submit, isPending } = useFormAction(withdrawRecruitmentApplicationAction, {
		loadingMessage: "Withdrawing application…",
		successMessage: "Application withdrawn",
	});

	function withdraw() {
		const fd = new FormData();
		fd.set("applicationId", application.id);
		submit(fd);
	}

	return (
		<div className="space-y-3 border p-4">
			<div className="flex items-start gap-3">
				<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={application.applicantAvatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-[10px] font-bold">
						{application.senderDisplayName.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="truncate text-sm font-medium">{application.listingTitle}</p>
						<Badge variant="secondary" className="text-[10px]">
							{RECRUITMENT_CATEGORY_LABELS[application.listingCategory]}
						</Badge>
						<Badge variant="outline" className="text-[10px] capitalize">
							{application.status}
						</Badge>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						Sent as{" "}
						{application.senderTeamName
							? `[${application.senderTeamTag}] ${application.senderTeamName}`
							: (application.senderOrganizationName ?? application.senderDisplayName)}
					</p>
					{application.message && (
						<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
							{application.message}
						</p>
					)}
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				{application.conversationId && (
					<Button asChild size="sm" variant="outline">
						<Link
							href={`${
								conversationHrefBase ?? appRoutes.recruiting.conversations
							}?conversation=${application.conversationId}`}
						>
							Open conversation
						</Link>
					</Button>
				)}
				{application.status === "pending" && (
					<Button size="sm" variant="outline" onClick={withdraw} disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Withdraw
					</Button>
				)}
			</div>
		</div>
	);
}

export function RecruitmentSentApplicationsPanel({
	applications,
	conversationHrefBase,
}: RecruitmentSentApplicationsPanelProps) {
	if (applications.length === 0) {
		return <p className="text-xs text-muted-foreground">You have not sent any applications yet.</p>;
	}

	return (
		<div className="space-y-3">
			{applications.map((application) => (
				<SentApplicationCard
					key={application.id}
					application={application}
					conversationHrefBase={conversationHrefBase}
				/>
			))}
		</div>
	);
}
