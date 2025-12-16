import { z } from "zod";
import {
  AVAILABILITY_STATUSES,
  DAYS_OF_WEEK,
  ELO_REASONS,
  FLAG_SEVERITIES,
  GLOBAL_ROLES,
  INVITE_STATUSES,
  OCR_STATUSES,
  ORG_ROLES,
  PROVIDER_TYPES,
  REGIONS,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  SCRIM_FORMATS,
  SCRIM_PREFERENCE_TYPES,
  SCRIM_STATUSES,
  TEAM_ROLES,
  TEAM_ROSTER_STATUSES,
  VERIFICATION_STATUSES,
  VERIFICATION_TYPES,
} from "./constants";

type StringEnumValues = readonly [string, ...string[]];

const toZodEnum = <T extends StringEnumValues>(values: T) => z.enum(values);

export const GlobalRoleEnum = toZodEnum(GLOBAL_ROLES);
export const ProviderEnum = toZodEnum(PROVIDER_TYPES);
export const OrgRoleEnum = toZodEnum(ORG_ROLES);
export const TeamRoleEnum = toZodEnum(TEAM_ROLES);
export const TeamRosterStatusEnum = toZodEnum(TEAM_ROSTER_STATUSES);
export const ScrimFormatEnum = toZodEnum(SCRIM_FORMATS);
export const ScrimStatusEnum = toZodEnum(SCRIM_STATUSES);
export const RequestTypeEnum = toZodEnum(REQUEST_TYPES);
export const DayOfWeekEnum = toZodEnum(DAYS_OF_WEEK);
export const AvailabilityStatusEnum = toZodEnum(AVAILABILITY_STATUSES);
export const VerificationTypeEnum = toZodEnum(VERIFICATION_TYPES);
export const ScrimPreferenceTypeEnum = toZodEnum(SCRIM_PREFERENCE_TYPES);
export const InviteStatusEnum = toZodEnum(INVITE_STATUSES);
export const RequestStatusEnum = toZodEnum(REQUEST_STATUSES);
export const OcrStatusEnum = toZodEnum(OCR_STATUSES);
export const VerificationStatusEnum = toZodEnum(VERIFICATION_STATUSES);
export const FlagSeverityEnum = toZodEnum(FLAG_SEVERITIES);
export const RegionEnum = toZodEnum(REGIONS);
export const EloReasonEnum = toZodEnum(ELO_REASONS);

export const idSchema = z.string().uuid({ message: "Invalid UUID format" });

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const coerceDate = z.coerce
  .date()
  .catch(() => new Date())
  .pipe(z.date());

export const dateRangeSchema = z
  .object({
    from: coerceDate,
    to: coerceDate,
  })
  .refine((data) => data.to > data.from, {
    message: "End date must be after start date",
    path: ["to"],
  });

export const trimmedString = (min = 1, max = 255, message?: string) =>
  z
    .string()
    .trim()
    .min(min, message ?? `Must be at least ${min} characters`)
    .max(max, message ?? `Must be ${max} characters or less`);

export const optionalTrimmedString = (max = 255) =>
  z.string().trim().max(max, `Must be ${max} characters or less`).optional();

export const nullableTrimmedString = (max = 255) =>
  optionalTrimmedString(max)
    .nullable()
    .transform((value) =>
      value === null || value === undefined || value === "" ? undefined : value,
    );

export const emailSchema = z
  .email("Invalid email address")
  .trim()
  .max(320, "Email is too long");

export const urlSchema = z
  .url("Invalid URL")
  .trim()
  .max(2048, "URL is too long");

export const optionalUrlSchema = urlSchema.optional();

export const slugSchema = z
  .string()
  .trim()
  .min(3, "Slug must be at least 3 characters")
  .max(50, "Slug must be 50 characters or less")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be kebab-case lowercase");

export const booleanStringSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

export const numericIdSchema = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value))
  .pipe(
    z.number().int().nonnegative({ message: "Must be a non-negative integer" }),
  );

export const uuidListSchema = z
  .array(idSchema)
  .min(1, "At least one id is required");

export const isoDateStringSchema = z
  .string()
  .trim()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO date string",
  )
  .transform((value) => new Date(value));
