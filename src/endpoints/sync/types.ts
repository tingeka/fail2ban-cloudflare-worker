import { z } from "zod";
import { IpAddressSchema, BanDurationSchema } from "@src/types";

export const CloudflareSyncSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain cannot be empty")
    .refine(
      (d) => !d.includes(",") && !d.includes(" "),
      { message: "Only a single domain is allowed" }
    ),
  bans: z.record(IpAddressSchema, BanDurationSchema),
});

export type CloudflareSyncRequest = z.infer<typeof CloudflareSyncSchema>;
export type BansMap = CloudflareSyncRequest["bans"];