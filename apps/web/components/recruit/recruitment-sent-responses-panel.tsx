"use client";

import type { RecruitmentResponseSummary } from "@scrimflow/shared";
import Link from "next/link";

import { withdrawRecruitmentResponseAction } from "@/app/dashboard/recruit/actions/recruit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";
import { dashboardRoutes } from "@/lib/routes";

interface RecruitmentSentResponsesPanelProps {
	responses: RecruitmentResponseSummary[];
	conversationHrefBase?: string;
}

function SentResponseCard({
	response,
	conversationHrefBase,
}: {
	response: RecruitmentResponseSummary;
	conversationHrefBase?: string;
}) {
	const { submit, isPending } = useFormAction(withdrawRecruitmentResponseAction, {
		loadingMessage: "Withdrawing response…",
		successMessage: "Response withdrawn",
	});

	function withdraw() {
		const fd = new FormData();
		fd.set("responseId", response.id);
		submit(fd);
	}

	return (
		<div className="space-y-3 border p-4">
			<div className="flex items-start gap-3">
				<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={response.applicantAvatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-[10px] font-bold">
						{response.senderDisplayName.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="truncate text-sm font-medium">{response.postTitle}</p>
						<Badge variant="secondary" className="text-[10px]">
							{RECRUITMENT_CATEGORY_LABELS[response.postCategory]}
						</Badge>
						<Badge variant="outline" className="text-[10px] capitalize">
							{response.status}
						</Badge>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						Sent as{" "}
						{response.senderTeamName
							? `[${response.senderTeamTag}] ${response.senderTeamName}`
							: (response.senderOrganizationName ?? response.senderDisplayName)}
					</p>
					{response.message && (
						<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
							{response.message}
						</p>
					)}
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				{response.threadId && (
					<Button asChild size="sm" variant="outline">
						<Link
							href={`${
								conversationHrefBase ?? dashboardRoutes.discover.conversations
							}?thread=${response.threadId}`}
						>
							Open conversation
						</Link>
					</Button>
				)}
				{response.status === "pending" && (
					<Button size="sm" variant="outline" onClick={withdraw} disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Withdraw
					</Button>
				)}
			</div>
		</div>
	);
}

export function RecruitmentSentResponsesPanel({
	responses,
	conversationHrefBase,
}: RecruitmentSentResponsesPanelProps) {
	if (responses.length === 0) {
		return <p className="text-xs text-muted-foreground">You have not sent any responses yet.</p>;
	}

	return (
		<div className="space-y-3">
			{responses.map((response) => (
				<SentResponseCard
					key={response.id}
					response={response}
					conversationHrefBase={conversationHrefBase}
				/>
			))}
		</div>
	);
}
