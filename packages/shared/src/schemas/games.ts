import { z } from "zod";
import {
  idSchema,
  optionalTrimmedString,
  optionalUrlSchema,
  slugSchema,
  trimmedString,
  urlSchema,
} from "./common";

const statTypeEnum = z.enum(["number", "boolean", "duration"]);

export const gameStatSchema = z
  .array(
    z.object({
      label: trimmedString(2, 100, "Stat label is required"),
      key: trimmedString(2, 100, "Stat key is required"),
      type: statTypeEnum,
    }),
  )
  .min(1, "Provide at least one stat definition");

export const gameModeSchema = z.object({
  slug: slugSchema,
  name: trimmedString(2, 100, "Mode name is required"),
  teamSize: z.number().int().min(1, "Team size must be at least 1"),
  allowedMaps: z.array(trimmedString(1, 100)).min(1, "Add at least one map"),
});

export const gameConfigSchema = z.object({
  roles: z.array(trimmedString(1, 50)).min(1, "Add at least one role"),
  modes: z.array(gameModeSchema).min(1, "Add at least one mode"),
});

export const createGameSchema = z.object({
  name: trimmedString(2, 100, "Game name must be between 2 and 100 characters"),
  slug: slugSchema,
  logoUrl: optionalUrlSchema,
  metadata: gameConfigSchema,
  statSchema: gameStatSchema,
  statSchemaVersion: z.number().int().positive().default(1),
});

export const updateGameSchema = z
  .object({
    gameId: idSchema,
    name: optionalTrimmedString(100),
    slug: slugSchema.optional(),
    logoUrl: optionalUrlSchema,
    metadata: gameConfigSchema.optional(),
    statSchema: gameStatSchema.optional(),
    statSchemaVersion: z.number().int().positive().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export const createMapSchema = z.object({
  gameId: idSchema,
  name: trimmedString(2, 100, "Map name is required"),
  slug: slugSchema,
  imageUrl: urlSchema,
  isActive: z.boolean().default(true),
});

export const updateMapSchema = z
  .object({
    mapId: idSchema,
    name: optionalTrimmedString(100),
    slug: slugSchema.optional(),
    imageUrl: optionalUrlSchema,
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export const createGameStatTemplateSchema = z.object({
  gameId: idSchema,
  version: z.number().int().positive(),
  schema: gameStatSchema,
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
export type CreateMapInput = z.infer<typeof createMapSchema>;
export type UpdateMapInput = z.infer<typeof updateMapSchema>;
export type CreateGameStatTemplateInput = z.infer<
  typeof createGameStatTemplateSchema
>;
