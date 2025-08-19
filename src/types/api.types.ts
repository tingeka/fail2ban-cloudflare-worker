// src/types/api.types.ts
import { z } from "zod";

// The request schema still works well as a generic, so we can keep it.
export const ApiRequestSchema = <T extends z.ZodTypeAny>(bodySchema: T) =>
  z.object({ body: bodySchema });

// We define a base for the API success/error responses.
const BaseApiResponseSchema = z.object({
  message: z.string(),
});

export const ApiSuccessResponseSchema = BaseApiResponseSchema.extend({
  success: z.literal(true),
});

export const ApiErrorResponseSchema = BaseApiResponseSchema.extend({
  success: z.literal(false),
});

// Now we can create the type aliases. For the success response, we'll
// define a new type that includes the generic data field. This is the cleanest approach.
export type ApiSuccessResponse<TData> = z.infer<typeof ApiSuccessResponseSchema> & { data?: TData };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;