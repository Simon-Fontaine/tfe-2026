export const STATUS_BADGE_CLASSES = {
	// Match / scrim outcomes
	win: "border-green-600 text-green-600",
	loss: "border-destructive text-destructive",
	draw: "border-muted-foreground/40 text-muted-foreground",
	ratingGain: "border-green-600 text-green-600",
	ratingLoss: "border-destructive text-destructive",

	// Lifecycle — success / active
	completed: "border-green-600 text-green-600",
	resolved: "border-green-600 text-green-600",
	active: "border-green-600 text-green-600",
	open: "border-green-600 text-green-700",
	recruiting: "border-green-600 text-green-600",

	// Lifecycle — warning
	paused: "border-yellow-600 text-yellow-700",
	benched: "border-yellow-600 text-yellow-600",
	trial: "border-blue-600 text-blue-600",
	underReview: "border-blue-500 text-blue-500",
	suspended: "border-orange-500 text-orange-500",
	pending: "border-orange-500 text-orange-500",

	// Lifecycle — error / danger
	disputed: "border-destructive text-destructive",
	irreversible: "border-destructive text-destructive",
	blocked: "border-destructive text-destructive",
	deletionPending: "border-destructive text-destructive",

	// Neutral / muted
	cancelled: "text-muted-foreground",
	voided: "text-muted-foreground",
	dismissed: "",
	inactive: "border-muted-foreground/40 text-muted-foreground",

	// Roster status
	rosterActive: "border-green-600 text-green-600",
	rosterBenched: "border-yellow-600 text-yellow-600",
	rosterTrial: "border-blue-600 text-blue-600",
	rosterInactive: "border-muted-foreground/40 text-muted-foreground",

	// Moderation report status
	reportPending: "border-orange-500 text-orange-500",
	reportUnderReview: "border-blue-500 text-blue-500",
	reportResolved: "border-green-600 text-green-600",
	reportDismissed: "",
} as const;
