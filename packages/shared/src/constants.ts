export const GLOBAL_ROLES = ["admin", "staff", "user"] as const;

export const PROVIDER_TYPES = [
  "steam",
  "discord",
  "riot",
  "twitch",
  "battle_net",
] as const;

export const SCRIM_FORMATS = ["BO1", "BO2", "BO3", "BO5", "BO7"] as const;

export const SCRIM_STATUSES = [
  "DRAFT",
  "PENDING",
  "CONFIRMED",
  "LIVE",
  "PROCESSING",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
] as const;

export const ORG_ROLES = ["owner", "admin", "manager", "member"] as const;

export const TEAM_ROLES = [
  "owner",
  "captain",
  "player",
  "coach",
  "analyst",
  "manager",
] as const;

export const TEAM_ROSTER_STATUSES = [
  "STARTER",
  "SUBSTITUTE",
  "INACTIVE",
] as const;

export const ELO_REASONS = [
  "match",
  "penalty",
  "decay",
  "rollback",
  "calibration",
] as const;

export const REQUEST_TYPES = ["SEARCH", "OFFER"] as const;

export const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export const AVAILABILITY_STATUSES = [
  "AVAILABLE",
  "UNAVAILABLE",
  "TENTATIVE",
] as const;

export const VERIFICATION_TYPES = [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
  "ACCOUNT_DELETION",
  "EMAIL_CHANGE",
] as const;

export const SCRIM_PREFERENCE_TYPES = ["AVOID", "PREFER"] as const;

export const INVITE_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const REQUEST_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "FULFILLED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const OCR_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "MANUAL_REVIEW",
] as const;

export const VERIFICATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export const FLAG_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const REGIONS = ["EU", "NA", "KR", "CN", "OCE", "SA"] as const;
