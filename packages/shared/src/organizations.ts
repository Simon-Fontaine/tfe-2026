import { z } from "zod";
import {
  optionalTrimmedString,
  optionalUrlSchema,
  slugSchema,
  trimmedString,
} from "./common";

export const createOrganizationSchema = z.object({
  name: trimmedString(
    2,
    255,
    "Organization name must be between 2 and 255 characters",
  ),
  slug: slugSchema,
  timezone: optionalTrimmedString(50),
  logoUrl: optionalUrlSchema,
});

export const updateOrganizationSchema = z
  .object({
    name: optionalTrimmedString(255),
    slug: slugSchema.optional(),
    timezone: optionalTrimmedString(50),
    logoUrl: optionalUrlSchema,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
