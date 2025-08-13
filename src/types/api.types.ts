import { z } from "zod";

export const ApiRequestSchema = <T extends z.ZodTypeAny>(bodySchema: T) =>
  z.object({ body: bodySchema });

export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: dataSchema.optional(),
  });

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data?: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
};
