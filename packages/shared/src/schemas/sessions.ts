import { z } from "zod";
import { idSchema, optionalTrimmedString, trimmedString } from "./common";

export const sessionLocationSchema = z
  .object({
    city: optionalTrimmedString(255),
    region: optionalTrimmedString(255),
    country: optionalTrimmedString(255),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict();

export const sessionMetadataSchema = z.object({
  ipAddress: trimmedString(
    1,
    45,
    "IP address must be 45 characters or less",
  ).optional(),
  location: sessionLocationSchema.optional(),
  device: optionalTrimmedString(255),
  userAgent: optionalTrimmedString(1024),
});

export const createSessionSchema = z.object({
  userId: idSchema,
  sessionToken: trimmedString(1, 255, "Session token is required"),
  expiresAt: z.coerce.date(),
  ipAddress: sessionMetadataSchema.shape.ipAddress,
  location: sessionMetadataSchema.shape.location,
  device: sessionMetadataSchema.shape.device,
  userAgent: sessionMetadataSchema.shape.userAgent,
});

export type SessionLocationInput = z.infer<typeof sessionLocationSchema>;
export type SessionMetadataInput = z.infer<typeof sessionMetadataSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
