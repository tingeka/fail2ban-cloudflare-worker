import { z } from "zod";

export const IpAddressSchema = z.string().ip();

export const BanDurationSchema = z.number().positive().int();
