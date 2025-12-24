import { z } from "zod";

export const geoLookupSuccessSchema = z.object({
  query: z.string().trim().min(1),
  status: z.literal("success"),
  country: z.string().trim().min(1),
  countryCode: z.string().trim().min(2).max(2),
  region: z.string().trim().min(1),
  regionName: z.string().trim().min(1),
  city: z.string().trim().min(1),
  zip: z.string().trim(),
  lat: z.number(),
  lon: z.number(),
  timezone: z.string().trim().min(1),
  isp: z.string().trim(),
  org: z.string().trim(),
  as: z.string().trim(),
});

export const geoLookupFailureSchema = z.object({
  query: z.string().trim().min(1).optional(),
  status: z.literal("fail"),
  message: z.string().trim().min(1).optional(),
});

export const geoLookupResponseSchema = z.union([
  geoLookupSuccessSchema,
  geoLookupFailureSchema,
]);

export type GeoLookupSuccess = z.infer<typeof geoLookupSuccessSchema>;
export type GeoLookupFailure = z.infer<typeof geoLookupFailureSchema>;
export type GeoLookupResponse = z.infer<typeof geoLookupResponseSchema>;
