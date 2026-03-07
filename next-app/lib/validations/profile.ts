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

// ─── Update basic user info ───────────────────────────────────────────────────

export const UpdateBasicInfoSchema = v.object({
	displayName: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, "Display name must be at least 2 characters"),
		v.maxLength(32, "Display name cannot exceed 32 characters")
	),
	bio: v.optional(v.pipe(v.string(), v.maxLength(280, "Bio cannot exceed 280 characters"))),
	socialLinks: v.optional(
		v.object({
			twitter: v.optional(v.pipe(v.string(), v.maxLength(100))),
			discord: v.optional(v.pipe(v.string(), v.maxLength(100))),
			twitch: v.optional(v.pipe(v.string(), v.maxLength(100))),
			youtube: v.optional(v.pipe(v.string(), v.maxLength(100))),
		})
	),
});

export type UpdateBasicInfoInput = v.InferOutput<typeof UpdateBasicInfoSchema>;

// ─── Update game profile ──────────────────────────────────────────────────────

export const UpdateGameProfileSchema = v.pipe(
	v.object({
		battletag: v.optional(
			v.pipe(
				v.string(),
				v.trim(),
				v.maxLength(20, "BattleTag is too long"),
				v.regex(
					/^[a-zA-Z0-9]{3,12}#\d{4,5}$/,
					"Must be in the format Name#1234 (e.g. Soldier76#1234)"
				)
			)
		),
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
		heroPool: v.pipe(v.array(v.string()), v.minLength(1, "Please select at least one hero")),
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

export type UpdateGameProfileInput = v.InferOutput<typeof UpdateGameProfileSchema>;

// ─── Availability ─────────────────────────────────────────────────────────────

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const AvailabilitySchema = v.pipe(
	v.object({
		type: v.picklist(["recurring", "one_off"] as const, "Please select a type"),
		dayOfWeek: v.optional(
			v.nullable(
				v.pipe(v.number(), v.integer(), v.minValue(0, "Invalid day"), v.maxValue(6, "Invalid day"))
			)
		),
		specificDate: v.optional(v.nullable(v.string())),
		startTime: v.pipe(v.string(), v.regex(TIME_REGEX, "Start time must be in HH:MM format")),
		endTime: v.pipe(v.string(), v.regex(TIME_REGEX, "End time must be in HH:MM format")),
		timezone: v.pipe(v.string(), v.minLength(1, "Please select a timezone")),
		label: v.optional(v.pipe(v.string(), v.maxLength(40, "Label cannot exceed 40 characters"))),
	}),
	v.forward(
		v.check(
			(input) =>
				input.type !== "recurring" || (input.dayOfWeek !== null && input.dayOfWeek !== undefined),
			"Please select a day of the week"
		),
		["dayOfWeek"]
	),
	v.forward(
		v.check((input) => input.type !== "one_off" || !!input.specificDate, "Please select a date"),
		["specificDate"]
	),
	v.forward(
		v.check(
			(input) => !input.startTime || !input.endTime || input.endTime > input.startTime,
			"End time must be after start time"
		),
		["endTime"]
	)
);

export type AvailabilityInput = v.InferOutput<typeof AvailabilitySchema>;
