import {
  type AppContext,
} from "@src/types";
import {
  CloudflareSyncRequest,
} from "./types";
import { OpenAPIRoute } from "chanfana";
import { CloudflareSyncService } from "@src/services/cloudflare-sync.service";
import { ConfigError, DisallowedDomainError, DisallowedIpError } from "@src/lib/throws";
import { parseCommaSeparatedList } from "@src/lib/utils";
import { createLogger } from "@src/lib/logger";
import { CloudflareAPI } from "@src/clients";

import { SyncPostSchema } from "./schemas";
import { ZodError } from "zod";

export class SyncPostAction extends OpenAPIRoute {
  schema = SyncPostSchema;

  private _authorizeRequest(c: AppContext, log: ReturnType<typeof createLogger>): void {
    if (c.env.ALLOWED_IPS) {
      const callerIp = c.req.header("CF-Connecting-IP") || "unknown";
      log.info(`Request from IP: ${callerIp}`);
      const allowedIps = parseCommaSeparatedList(c.env.ALLOWED_IPS);
      if (!allowedIps.includes(callerIp)) {
        log.warn(`Unauthorized IP ${callerIp} attempted access`);
        throw new DisallowedIpError(callerIp);
      }
    }
  }

  private _createSyncService(c: AppContext, log: ReturnType<typeof createLogger>): CloudflareSyncService {
    const cloudflareClient = new CloudflareAPI(log);
    return new CloudflareSyncService(c.env, cloudflareClient, log);
  }

  private _handleError(c: AppContext, log: ReturnType<typeof createLogger>, startTime: number, domain: string, error: unknown) {
    const duration = Date.now() - startTime;
    log.error(`Failed for ${domain} after ${duration}ms:`, (error as Error).message);
    
    if (error instanceof DisallowedIpError || error instanceof DisallowedDomainError) {
      return c.json({ success: false, message: error.message }, 403);
    }
    if (error instanceof ConfigError) {
      return c.json({ success: false, message: error.message }, 500);
    }
   
    if (error instanceof ZodError) {
      return c.json({
        success: false,
        message: "Validation failed",
        issues: error.issues.map(i => ({ code: i.code, path: i.path, message: i.message })),
      }, 400);
    }

    return c.json({ success: false, message: `Internal server error: ${(error as Error).message}` }, 500);
  }

  async handle(c: AppContext) {

    const startTime = Date.now();
    const log = createLogger(c.env, crypto.randomUUID());
    let domain = "";
    let banCount = 0;

    try {
      
      this._authorizeRequest(c, log);

      const data = await this.getValidatedData<typeof this.schema>();
      const requestBody: CloudflareSyncRequest = data.body;
      domain = requestBody.domain;
      banCount = Object.keys(requestBody.bans).length;

      log.info(`Starting sync for ${domain} with ${banCount} bans`);

      const service = this._createSyncService(c, log);
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
      return this._handleError(c, log, startTime, domain, error);
    }
  }
}
