import { fromHono } from "chanfana";
import { Hono } from "hono";
import type { Env } from "@src/types";

import { SyncActionPost } from "@src/endpoints/sync";

const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

app.all("*", (c) => {
  console.log("🔍 Catch-all hit:", c.req.method, c.req.path);
  return c.text(`Env variables: ${JSON.stringify(c.env, null, 2)}`, 200, {
    "Content-Type": "text/plain",
  });
});

// Register your Cloudflare sync endpoint as GET only
openapi.post("/api/sync", SyncActionPost);


// Export the app
export default app;
