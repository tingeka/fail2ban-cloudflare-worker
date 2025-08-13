import { fromHono } from "chanfana";
import { Hono } from "hono";
import type { Env } from "@src/types";

import { SyncActionPost } from "@src/endpoints/sync";

const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register your Cloudflare sync endpoint as GET only
openapi.post("/api/sync", SyncActionPost);

// Export the app
export default app;
