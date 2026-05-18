import * as v from "valibot";

const OW2_ROLE_VALUES = ["tank", "damage", "support"] as const;
const OW2_RANK_VALUES = [
	"bronze",
	"silver",
	"gold",
	"platinum",
	"diamond",
	"master",
	"grandmaster",
	"champion",
] as const;
const ONBOARDING_STEP_VALUES = ["battletag", "roles-and-rank", "hero-pool", "intent"] as const;
const PARTICIPATION_INTENT_VALUES = [
	"find_team",
	"recruit_players",
	"schedule_scrims",
	"just_browsing",
] as const;
const AVAILABILITY_INTENT_VALUES = ["weekdays", "weekends", "flexible", "not_sure"] as const;

// ─── Step 1: BattleTag ────────────────────────────────────────────────────────

export const BattletagSchema = v.object({
	battletag: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("BattleTag is required"),
		v.maxLength(20, "BattleTag is too long"),
		v.regex(/^[a-zA-Z0-9]{3,12}#\d{4,5}$/, "Must be in the format Name#1234 (e.g. Soldier76#1234)")
	),
});

export type BattletagInput = v.InferOutput<typeof BattletagSchema>;

// ─── Step 2: Roles & Rank ─────────────────────────────────────────────────────

export const RolesAndRankSchema = v.pipe(
	v.object({
		primaryRole: v.picklist(OW2_ROLE_VALUES, "Please select a primary role"),
		secondaryRole: v.optional(v.nullable(v.picklist(OW2_ROLE_VALUES))),
		rank: v.optional(v.nullable(v.picklist(OW2_RANK_VALUES))),
		rankDivision: v.optional(
			v.nullable(
				v.pipe(
					v.number(),
					v.integer("Division must be a whole number"),
					v.minValue(1, "Division must be between 1 and 5"),
					v.maxValue(5, "Division must be between 1 and 5")
				)
			)
		),
	}),
	v.forward(
		v.check(
			(input) => !input.secondaryRole || input.secondaryRole !== input.primaryRole,
			"Secondary role cannot be the same as your primary role"
		),
		["secondaryRole"]
	),
	v.forward(
		v.check(
			(input) => !input.rank || (input.rankDivision !== null && input.rankDivision !== undefined),
			"Please select a division for your rank"
		),
		["rankDivision"]
	)
);

export type RolesAndRankInput = v.InferOutput<typeof RolesAndRankSchema>;

// ─── Step 3: Hero Pool ────────────────────────────────────────────────────────

export const HeroPoolSchema = v.object({
	heroPool: v.pipe(v.array(v.string()), v.minLength(1, "Please select at least one hero")),
});

export type HeroPoolInput = v.InferOutput<typeof HeroPoolSchema>;

// ─── Step 4: Intent ───────────────────────────────────────────────────────────

export const IntentSchema = v.object({
	participationIntent: v.picklist(PARTICIPATION_INTENT_VALUES, "Please select what you want to do"),
	availabilityIntent: v.picklist(AVAILABILITY_INTENT_VALUES, "Please select your availability"),
});

export type IntentInput = v.InferOutput<typeof IntentSchema>;

// ─── Draft progress ──────────────────────────────────────────────────────────

const DraftBattletagSchema = v.optional(BattletagSchema.entries.battletag);
const DraftRoleSchema = v.optional(v.nullable(v.picklist(OW2_ROLE_VALUES)));
const DraftRankSchema = v.optional(v.nullable(v.picklist(OW2_RANK_VALUES)));
const DraftRankDivisionSchema = v.optional(
	v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)))
);

export const OnboardingDraftSchema = v.pipe(
	v.object({
		currentStep: v.optional(v.picklist(ONBOARDING_STEP_VALUES)),
		battletag: DraftBattletagSchema,
		primaryRole: DraftRoleSchema,
		secondaryRole: DraftRoleSchema,
		rank: DraftRankSchema,
		rankDivision: DraftRankDivisionSchema,
		heroPool: v.optional(v.array(v.string())),
		participationIntent: v.optional(v.nullable(v.picklist(PARTICIPATION_INTENT_VALUES))),
		availabilityIntent: v.optional(v.nullable(v.picklist(AVAILABILITY_INTENT_VALUES))),
	}),
	v.forward(
		v.check(
			(input) => !input.secondaryRole || input.secondaryRole !== input.primaryRole,
			"Secondary role cannot be the same as your primary role"
		),
		["secondaryRole"]
	),
	v.forward(
		v.check(
			(input) => !input.rank || (input.rankDivision !== null && input.rankDivision !== undefined),
			"Please select a division for your rank"
		),
		["rankDivision"]
	),
	v.forward(
		v.check(
			(input) => input.currentStep === "battletag" || !!input.battletag,
			"BattleTag is required before continuing"
		),
		["battletag"]
	),
	v.forward(
		v.check(
			(input) =>
				input.currentStep !== "hero-pool" && input.currentStep !== "intent"
					? true
					: !!input.primaryRole,
			"Primary role is required before continuing"
		),
		["primaryRole"]
	),
	v.forward(
		v.check(
			(input) => input.currentStep !== "intent" || !!input.heroPool?.length,
			"Please select at least one hero before continuing"
		),
		["heroPool"]
	)
);

export type OnboardingDraftInput = v.InferOutput<typeof OnboardingDraftSchema>;

// ─── Combined (server-side) ───────────────────────────────────────────────────

export const CreatePlayerProfileSchema = v.pipe(
	v.object({
		battletag: v.pipe(
			v.string(),
			v.trim(),
			v.nonEmpty("BattleTag is required"),
			v.maxLength(20, "BattleTag is too long"),
			v.regex(/^[a-zA-Z0-9]{3,12}#\d{4,5}$/, "Invalid BattleTag format")
		),
		primaryRole: v.picklist(OW2_ROLE_VALUES, "Primary role is required"),
		secondaryRole: v.optional(v.nullable(v.picklist(OW2_ROLE_VALUES))),
		rank: v.optional(v.nullable(v.picklist(OW2_RANK_VALUES))),
		rankDivision: v.optional(
			v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)))
		),
		heroPool: v.pipe(v.array(v.string()), v.minLength(1, "Hero pool cannot be empty")),
		participationIntent: v.picklist(
			PARTICIPATION_INTENT_VALUES,
			"Participation intent is required"
		),
		availabilityIntent: v.picklist(AVAILABILITY_INTENT_VALUES, "Availability is required"),
	}),
	v.forward(
		v.check(
			(input) => !input.secondaryRole || input.secondaryRole !== input.primaryRole,
			"Secondary role cannot be the same as your primary role"
		),
		["secondaryRole"]
	),
	v.forward(
		v.check(
			(input) => !input.rank || (input.rankDivision !== null && input.rankDivision !== undefined),
			"Please select a division for your rank"
		),
		["rankDivision"]
	)
);

export const CompleteOnboardingSchema = CreatePlayerProfileSchema;

export type CreatePlayerProfileInput = v.InferOutput<typeof CreatePlayerProfileSchema>;
export type CompleteOnboardingInput = v.InferOutput<typeof CompleteOnboardingSchema>;

export const OnboardingProgressDataSchema = v.object({
	battletag: v.optional(
		v.pipe(v.string(), v.trim(), v.maxLength(20), v.regex(/^[a-zA-Z0-9]{3,12}#\d{4,5}$/))
	),
	primaryRole: v.optional(v.nullable(v.picklist(OW2_ROLE_VALUES))),
	secondaryRole: v.optional(v.nullable(v.picklist(OW2_ROLE_VALUES))),
	rank: v.optional(v.nullable(v.picklist(OW2_RANK_VALUES))),
	rankDivision: DraftRankDivisionSchema,
	heroPool: v.optional(v.array(v.string())),
	participationIntent: v.optional(v.nullable(v.picklist(PARTICIPATION_INTENT_VALUES))),
	availabilityIntent: v.optional(v.nullable(v.picklist(AVAILABILITY_INTENT_VALUES))),
});

export type OnboardingProgressDataInput = v.InferOutput<typeof OnboardingProgressDataSchema>;
