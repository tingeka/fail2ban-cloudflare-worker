import { z } from "zod";

export const CloudflareMessageSchema = z.object({
  message: z.string(),
  code: z.number().optional(),
  source: z.object({ pointer: z.string() }).optional(),
});
export type CloudflareMessage = z.infer<typeof CloudflareMessageSchema>;

export const CloudflareAPISuccessResponseSchema = <T extends z.ZodTypeAny>(
  resultSchema: T
) =>
  z.object({
    success: z.literal(true),
    errors: z.array(CloudflareMessageSchema),
    messages: z.array(CloudflareMessageSchema),
    result: resultSchema,
  });

export const CloudflareAPIErrorResponseSchema = <T extends z.ZodTypeAny>(
  resultSchema: T
) =>
  z.object({
    success: z.literal(false),
    errors: z.array(CloudflareMessageSchema),
    messages: z.array(CloudflareMessageSchema),
    result: resultSchema,
  });

export type CloudflareAPIResponse<T, S extends boolean = boolean> = {
  success: S;
  errors: CloudflareMessage[];
  messages: CloudflareMessage[];
  result: T;
};

const RuleSchema = z.object({
  id: z.string(),
  description: z.string(),
}).passthrough();

export const RulesetResponseSchema = CloudflareAPISuccessResponseSchema(
  z.object({
    id: z.string(),
    rules: z.array(RuleSchema),
  })
);

export type RulesetResponse = z.infer<typeof RulesetResponseSchema>;
