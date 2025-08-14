import {
  type AppContext,
  ApiErrorResponseSchema,
  ApiSuccessResponseSchema,
} from "@src/types";
import {
  CloudflareSyncSchema,
  CloudflareSyncRequest,
} from "./types";
import { OpenAPIRoute } from "chanfana";
import { CloudflareSyncService } from "@src/services/cloudflare-sync.services";
import { ConfigError, DisallowedDomainError, DisallowedIpError } from "@src/lib/throws";
import { parseCommaSeparatedList } from "@src/lib/utils";
import { z } from "zod";
import { createLogger } from "@src/lib/logger";

export class SyncActionPost extends OpenAPIRoute {
  schema = {
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
            schema: ApiSuccessResponseSchema(z.object({})),
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

  async handle(c: AppContext) {

    const startTime = Date.now();
    const log = createLogger(c.env, crypto.randomUUID());
    let domain = "";
    let banCount = 0;

    try {
      const data = await this.getValidatedData<typeof this.schema>();
      const requestBody: CloudflareSyncRequest = data.body;
      domain = requestBody.domain;
      banCount = Object.keys(requestBody.bans).length;

      log.info(`Starting sync for ${domain} with ${banCount} bans`);

      if (c.env.ALLOWED_IPS) {
        const callerIp = c.req.header("CF-Connecting-IP") || "unknown";
        log.info(`Request from IP: ${callerIp}`);

        const allowedIps = parseCommaSeparatedList(c.env.ALLOWED_IPS);
        if (!allowedIps.includes(callerIp)) {
          log.warn(`Unauthorized IP ${callerIp} attempted access`);
          throw new DisallowedIpError(callerIp);
        }
      }

      const service = new CloudflareSyncService(c.env, log);
      const message = await service.syncBans(domain, data.body.bans);

      const duration = Date.now() - startTime;
      log.info(`Success for ${domain} in ${duration}ms`);

      return c.json({ success: true, message, data: data.body.bans });
      
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      log.error(
        `Failed for ${domain} after ${duration}ms:`,
        (error as Error).message
      );

      if (error instanceof DisallowedIpError || error instanceof DisallowedDomainError) {
        return c.json({ success: false, message: error.message }, 403);
      }

      if (error instanceof ConfigError) {
        return c.json({ success: false, message: error.message }, 500);
      }

      return c.json({ success: false, message: `Internal server error: ${(error as Error).message}` }, 500);
    }
  }
}
