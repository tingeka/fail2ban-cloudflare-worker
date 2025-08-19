// src/types/cloudflare-api.types.ts
import { z } from "zod";

export const CloudflareMessageSchema = z.object({
  message: z.string(),
  code: z.number().optional(),
  source: z.object({ pointer: z.string() }).optional(),
});

export const CloudflareAPISuccessResponseSchema = z.object({
  success: z.literal(true),
  errors: z.array(CloudflareMessageSchema),
  messages: z.array(CloudflareMessageSchema),
});

export const CloudflareAPIErrorResponseSchema = z.object({
  success: z.literal(false),
  errors: z.array(CloudflareMessageSchema),
  messages: z.array(CloudflareMessageSchema),
});

export const RuleSchema = z.object({
  id: z.string(),
  description: z.string(),
}).passthrough();

export const RulesetResultSchema = z.object({
  id: z.string(),
  rules: z.array(RuleSchema),
});

export const RulesetResponseSchema = CloudflareAPISuccessResponseSchema.extend({
  result: RulesetResultSchema,
});

// We use z.infer to create a single, definitive type alias for the result.
export type RulesetResult = z.infer<typeof RulesetResultSchema>;
export type RulesetResponse = z.infer<typeof RulesetResponseSchema>;