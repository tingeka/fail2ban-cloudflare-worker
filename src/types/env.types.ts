import type { Context } from "hono";

export interface Env {
  ALLOWED_DOMAINS: string;
  ALLOWED_IPS: string;
  [key: `ZONE_ID_${string}`]: string;
  [key: `API_TOKEN_${string}`]: string;
  RULE_NAME: string;
}

export type AppContext = Context<{ Bindings: Env }>;
