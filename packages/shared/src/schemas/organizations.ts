import { z } from "zod";
import {
  idSchema,
  OrgRoleEnum,
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

export const addOrganizationMemberSchema = z.object({
  organizationId: idSchema,
  userId: idSchema,
  role: OrgRoleEnum.default("member"),
});

export const updateOrganizationMemberSchema = z
  .object({
    organizationId: idSchema,
    memberId: idSchema,
    role: OrgRoleEnum.optional(),
  })
  .refine((data) => data.role !== undefined, {
    message: "Provide at least one field to update",
  });

export const removeOrganizationMemberSchema = z.object({
  organizationId: idSchema,
  memberId: idSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type AddOrganizationMemberInput = z.infer<
  typeof addOrganizationMemberSchema
>;
export type UpdateOrganizationMemberInput = z.infer<
  typeof updateOrganizationMemberSchema
>;
export type RemoveOrganizationMemberInput = z.infer<
  typeof removeOrganizationMemberSchema
>;
