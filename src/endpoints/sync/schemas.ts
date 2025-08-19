// src/endpoints/sync/schemas.ts
import { z } from "zod";
import { ApiErrorResponseSchema, ApiSuccessResponseSchema } from "@src/types";
import { CloudflareSyncSchema } from "./types";

export const SyncPostSchema = {
  tags: ["Cloudflare"],
  summary: "Sync bans to Cloudflare firewall rule",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CloudflareSyncSchema,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Sync succeeded",
      content: {
        "application/json": {
          schema: ApiSuccessResponseSchema.extend({
            data: z.object({ bans: z.record(z.string(), z.number()) }), 
          }),
        },
      },
    },
    "400": {
      description: "Bad request",
      content: {
        "application/json": {
          schema: ApiErrorResponseSchema,
        },
      },
    },
    "403": {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ApiErrorResponseSchema,
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
};