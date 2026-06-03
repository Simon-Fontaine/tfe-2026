"use client";

import { appRoutes } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const CATEGORIES = [
	{ label: "All Categories", value: "" },
	{ label: "Harassment", value: "harassment" },
	{ label: "Spam", value: "spam" },
	{ label: "Impersonation", value: "impersonation" },
	{ label: "Abuse", value: "abuse" },
	{ label: "Evidence Manipulation", value: "evidence_manipulation" },
	{ label: "Dispute Abuse", value: "dispute_abuse" },
	{ label: "Suspicious Recruiting", value: "suspicious_recruiting" },
	{ label: "Other", value: "other" },
] as const;

const TARGET_TYPES = [
	{ label: "All Targets", value: "" },
	{ label: "User", value: "user" },
	{ label: "Team", value: "team" },
	{ label: "Organization", value: "organization" },
	{ label: "Listing", value: "listing" },
	{ label: "Message", value: "message" },
	{ label: "Scrim", value: "scrim" },
	{ label: "Update", value: "update" },
	{ label: "OCR Evidence", value: "ocr_evidence" },
] as const;

const ASSIGNED_TO_OPTIONS = [
	{ label: "All", value: "" },
	{ label: "Mine", value: "me" },
	{ label: "Unassigned", value: "unassigned" },
] as const;

interface QueueFiltersProps {
	activeStatus: string;
	activeCategory: string;
	activeTargetType: string;
	activeAssignedTo: string;
}

export function QueueFilters({
	activeStatus,
	activeCategory,
	activeTargetType,
	activeAssignedTo,
}: QueueFiltersProps) {
	const router = useRouter();

	const buildHref = useCallback(
		(overrides: {
			status?: string;
			category?: string;
			targetType?: string;
			assignedTo?: string;
		}) => {
			const status = overrides.status ?? activeStatus;
			const category = overrides.category !== undefined ? overrides.category : activeCategory;
			const targetType =
				overrides.targetType !== undefined ? overrides.targetType : activeTargetType;
			const assignedTo =
				overrides.assignedTo !== undefined ? overrides.assignedTo : activeAssignedTo;

			const parts: string[] = [];
			if (status && status !== "all") parts.push(`status=${status}`);
			if (category) parts.push(`category=${category}`);
			if (targetType) parts.push(`targetType=${targetType}`);
			if (assignedTo) parts.push(`assignedTo=${assignedTo}`);

			return parts.length > 0
				? `${appRoutes.moderation.root}?${parts.join("&")}`
				: appRoutes.moderation.root;
		},
		[activeStatus, activeCategory, activeTargetType, activeAssignedTo]
	);

	const pillClass = (active: boolean) =>
		active
			? "inline-flex items-center px-3 py-1 text-sm font-medium ring-1 ring-inset bg-primary text-primary-foreground ring-primary"
			: "inline-flex items-center px-3 py-1 text-sm font-medium ring-1 ring-inset text-foreground ring-border hover:bg-muted";

	const selectClass = "border border-border bg-background px-2 py-1 text-sm text-foreground";

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs font-medium text-muted-foreground">Assigned to:</span>
				{ASSIGNED_TO_OPTIONS.map((opt) => (
					<button
						key={opt.value}
						type="button"
						onClick={() => router.push(buildHref({ assignedTo: opt.value }))}
						className={pillClass(activeAssignedTo === opt.value)}
					>
						{opt.label}
					</button>
				))}
			</div>

			<div className="flex flex-wrap gap-3">
				<select
					value={activeCategory}
					onChange={(e) => router.push(buildHref({ category: e.target.value }))}
					className={selectClass}
					aria-label="Filter by category"
				>
					{CATEGORIES.map((c) => (
						<option key={c.value} value={c.value}>
							{c.label}
						</option>
					))}
				</select>

				<select
					value={activeTargetType}
					onChange={(e) => router.push(buildHref({ targetType: e.target.value }))}
					className={selectClass}
					aria-label="Filter by target type"
				>
					{TARGET_TYPES.map((t) => (
						<option key={t.value} value={t.value}>
							{t.label}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
