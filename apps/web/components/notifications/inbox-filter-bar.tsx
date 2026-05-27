"use client";

import { Button } from "@/components/ui/button";

export type InboxFilter = {
	unreadOnly: boolean;
	category: "all" | "scrim" | "team" | "recruiting" | "chat" | "security";
};

const CATEGORY_LABELS: Record<InboxFilter["category"], string> = {
	all: "All",
	scrim: "Scrim",
	team: "Team",
	recruiting: "Recruiting",
	chat: "Chat",
	security: "Security",
};

const CATEGORIES: InboxFilter["category"][] = [
	"all",
	"scrim",
	"team",
	"recruiting",
	"chat",
	"security",
];

interface InboxFilterBarProps {
	activeFilter: InboxFilter;
	onFilterChange: (filter: InboxFilter) => void;
}

export function InboxFilterBar({ activeFilter, onFilterChange }: InboxFilterBarProps) {
	return (
		<div className="flex flex-wrap items-center gap-2 pb-2">
			<Button
				size="sm"
				variant={activeFilter.unreadOnly ? "default" : "outline"}
				onClick={() => onFilterChange({ ...activeFilter, unreadOnly: !activeFilter.unreadOnly })}
			>
				Unread only
			</Button>

			<div className="flex flex-wrap gap-1">
				{CATEGORIES.map((category) => (
					<Button
						key={category}
						size="sm"
						variant={activeFilter.category === category ? "default" : "outline"}
						onClick={() => onFilterChange({ ...activeFilter, category })}
					>
						{CATEGORY_LABELS[category]}
					</Button>
				))}
			</div>
		</div>
	);
}
