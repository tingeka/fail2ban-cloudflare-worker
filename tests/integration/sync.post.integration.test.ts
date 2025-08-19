// File: tests/integration/endpoint-sync.integration.test.ts
import { Hono } from "hono";
import { fromHono } from "chanfana";
import { SyncPostAction } from "../../src/endpoints/sync";
import { mockEnv } from "../fixtures/env.mock";
import * as CloudflareClientModule from "../../src/clients/cloudflare.client";
import type { Env } from "../../src/types";
import type { ApiSuccessResponse, ApiErrorResponse } from "../../src/types/api.types";
import { jest } from "@jest/globals";

// Mock the CloudflareAPI
jest.mock("../../src/clients/cloudflare.client");

describe("SyncPostAction Integration", () => {
  let app: Hono<{ Bindings: Env }>;
  let mockCloudflareClient: jest.Mocked<CloudflareClientModule.CloudflareAPI>;

  const env: Env = {
    ...mockEnv,
    ALLOWED_IPS: "127.0.0.1",
    ALLOWED_DOMAINS: "example.com",
    LOG_LEVEL: "none", // Reduce noise in test output

    // Required by getDomainConfig for domain "example.com"
    ZONE_ID_EXAMPLE_COM: "zoneid-abc",
    API_TOKEN_EXAMPLE_COM: "token-abc",
  };

  beforeEach(() => {
      jest.clearAllMocks();

    // Build a plain object with all the methods you expect to be called
    mockCloudflareClient = {
      getRulesetByPhase: jest.fn(),
      createRuleset: jest.fn(),
      createRule: jest.fn(),
      updateRule: jest.fn(),
    } as unknown as jest.Mocked<CloudflareClientModule.CloudflareAPI>;

    // Whenever code under test does "new CloudflareAPI(...)", return our stub object
    (CloudflareClientModule.CloudflareAPI as unknown as jest.Mock).mockImplementation(() => mockCloudflareClient);

    // Mock “happy path”
    mockCloudflareClient.getRulesetByPhase
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "test-ruleset-id",
        rules: [{ id: "test-rule-id", description: "test-rule" }],
      });
    mockCloudflareClient.createRuleset.mockResolvedValue({
      id: "test-ruleset-id",
      rules: [],
    });
    mockCloudflareClient.createRule.mockResolvedValue("test-rule-id");
    mockCloudflareClient.updateRule.mockResolvedValue(undefined);

    type HonoEnv = { Bindings: Env };
    // Create the app the same way as in your main index.ts
    app = new Hono<HonoEnv>();

    // Setup OpenAPI registry - cast to avoid type mismatch
    const openapi = fromHono(app as Hono<HonoEnv>, {
      docs_url: "/",
    });

    // Register the endpoint exactly like in index.ts
    openapi.post("/api/sync", SyncPostAction);
  });

  describe("Validation", () => {
    it("rejects empty domain and invalid IPs with 400", async () => {
        const req = new Request("http://localhost/api/sync", {
          method: "POST",
          headers: {
            "CF-Connecting-IP": "127.0.0.1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: "", // Invalid: empty domain
          bans: { "not-an-ip": 3600 }, // Invalid: not an IP address
        }),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);

      const body = (await res.json()) as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.message).toBeDefined();
    });

  it.each([
    ["comma-separated domains", "domain.com,domainB.com"],
    ["space-separated domains", "domain.com domainB.com"],
  ])("rejects %s in the domain field with a 400", async (_desc, domainInput) => {
    const req = new Request("http://localhost/api/sync", {
      method: "POST",
      headers: { "CF-Connecting-IP": "127.0.0.1", "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: domainInput,
        bans: { "1.2.3.4": 3600 },
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = (await res.json()) as ApiErrorResponse;
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Validation failed/);
  });
  });

  describe("Authorization", () => {
    it("allows requests with a 200 when ALLOWED_IPS is not set", async () => {
      const envWithoutIpFiltering: Env = {
        ...mockEnv,
        ALLOWED_IPS: undefined,
        ALLOWED_DOMAINS: "example.com",
        LOG_LEVEL: "none",
  
        ZONE_ID_EXAMPLE_COM: "zoneid-abc",
        API_TOKEN_EXAMPLE_COM: "token-abc",
      };
  
      const req = new Request("http://localhost/api/sync", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": "any-ip-here",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain: "example.com", bans: {} }),
      });
  
      const res = await app.fetch(req, envWithoutIpFiltering);
      expect(res.status).toBe(200);
    });

    it("allows authorized IP with a 200", async () => {
      const req = new Request("http://localhost/api/sync", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": "127.0.0.1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: "example.com",
          bans: { "192.168.1.1": 3600 },
        }),
      });
  
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
    });

    it("rejects unauthorized IP with 403", async () => {
      const req = new Request("http://localhost/api/sync", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": "8.8.8.8",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain: "example.com", bans: {} }),
      });
  
      const res = await app.fetch(req, env);
      expect(res.status).toBe(403);
  
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.success).toBe(false);
      // Only check for relevant pattern, not exact message
      expect(body.message).toMatch(/IP.*not allowed/);
    });

    it("handles missing CF-Connecting-IP header when IP filtering is enabled", async () => {
      // In production behind Cloudflare, the CF-Connecting-IP header is always set by Cloudflare.
      // However, in local development, tests, or if a request somehow bypasses Cloudflare, it may be missing.
      // This test ensures our IP filtering logic handles the header being absent gracefully.
      const req = new Request("http://localhost/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain: "example.com", bans: {} }),
      });
  
      const res = await app.fetch(req, env);
      expect(res.status).toBe(403);
  
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/IP.*not allowed/);
    });
  });

  describe("Error handling", () => {
    it("bubbles up unexpected errors as 500", async () => {
      // Stub service to throw anything
      mockCloudflareClient.getRulesetByPhase.mockRejectedValue(new Error("something went wrong"));
  
      const req = new Request("http://localhost/api/sync", {
        method: "POST",
        headers: { "CF-Connecting-IP": "127.0.0.1", "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "example.com", bans: {} }),
      });
  
      const res = await app.fetch(req, env);
      expect(res.status).toBe(500);
  
      const body = await res.json() as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.message).toBeDefined();
    });
  });

  describe("Success responses", () => {
    it("returns 200 with JSON body on successful sync", async () => {
      const req = new Request("http://localhost/api/sync", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": "127.0.0.1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: "example.com",
          bans: { "192.168.1.1": 3600 },
        }),
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiSuccessResponse<Record<string, number>>;
      expect(body.success).toBe(true);
      expect(body.message).toBeDefined();
      expect(body.data).toEqual({ "192.168.1.1": 3600 });
    });
  });
});
