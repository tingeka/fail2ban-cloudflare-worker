// tests/endpoint.sync.test.ts
import { SyncActionPost as syncBans } from "../src/endpoints/sync/action-post";
import { ApiSuccessResponse, ApiErrorResponse, AppContext } from "../src/types";
import { mockEnv } from "./env.mock";
import { BansMap } from "../src/endpoints/sync/types";

// Mock the service since we test that separately
const mockSyncBans = jest.fn().mockResolvedValue("Successfully synced 1 IP bans for example.com");
jest.mock("../src/services/cloudflare-sync.services", () => ({
  CloudflareSyncService: jest.fn().mockImplementation(() => ({
    syncBans: mockSyncBans
  }))
}));

// Define the types for your mock objects
type MockRequest = {
  header: jest.Mock<string | null, [string]>;
  json: jest.Mock<Promise<{ domain: string; bans: BansMap }>, []>;
  getRequest: jest.Mock<Request, []>;
};

// This is a minimal mock of the Hono `RouteOptions` type
interface MockRouteOptions {
    router: unknown; // Use `unknown` to avoid 'any'
    raiseUnknownParameters: boolean;
    route: string;
    urlParams: Array<string>;
}

// This type now correctly reflects the data your code needs to function.
type ValidatedData = {
  body: {
    domain: string;
    bans: BansMap;
  };
  query: undefined;
  params: undefined;
  headers: undefined;
};

describe("CloudflareSync Endpoint", () => {
  let route: syncBans;
  let mockContext: AppContext;
  let mockRequest: MockRequest;

  beforeEach(() => {
    route = new syncBans({} as MockRouteOptions);

    mockSyncBans.mockClear();
    mockSyncBans.mockResolvedValue("Successfully synced 1 IP bans for example.com");

    mockRequest = {
      header: jest.fn(),
      json: jest.fn().mockResolvedValue({ domain: "example.com", bans: { "1.1.1.1": 3600 } }),
      getRequest: jest.fn(() => new Request('http://localhost/', { headers: { 'CF-Connecting-IP': '192.168.1.1' } })),
    };

    mockContext = {
      env: { ...mockEnv },
      req: mockRequest,
      json: jest.fn((body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })),
    } as unknown as AppContext;
  });

  afterEach(() => {
    mockSyncBans.mockReset();
    jest.restoreAllMocks();
  });

  it("should allow requests from authorized IPs and return bans in data key", async () => {
    const bansPayload = { "1.1.1.1": 3600 };
    // We cast to `unknown` first to bypass the compiler's type-check
    const getValidatedDataMock = jest.spyOn(route, 'getValidatedData') as unknown as jest.MockedFunction<() => Promise<ValidatedData>>;
    getValidatedDataMock.mockResolvedValue({
      body: { domain: "example.com", bans: bansPayload },
      query: undefined,
      params: undefined,
      headers: undefined,
    });

    mockRequest.header.mockReturnValue("127.0.0.1");

    const response = await route.handle(mockContext);
    const result = await response.json() as ApiSuccessResponse<BansMap>;

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Successfully synced");
    expect(result.data).toEqual(bansPayload);
  });

  it("should reject requests from unauthorized IPs", async () => {
    mockContext.env.ALLOWED_IPS = '127.0.0.1';
    mockRequest.header.mockReturnValue("192.168.1.1");
    // Apply the same fix here
    const getValidatedDataMock = jest.spyOn(route, 'getValidatedData') as unknown as jest.MockedFunction<() => Promise<ValidatedData>>;
    getValidatedDataMock.mockResolvedValue({
      body: { domain: "example.com", bans: { "1.1.1.1": 3600 } },
      query: undefined,
      params: undefined,
      headers: undefined,
    });

    const response = await route.handle(mockContext);
    const result = await response.json() as ApiErrorResponse;

    expect(response.status).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain("not allowed");
  });

  it("should work when IP restrictions are disabled", async () => {
    const bansPayload = { "1.1.1.1": 3600 };
    // Apply the same fix here
    const getValidatedDataMock = jest.spyOn(route, 'getValidatedData') as unknown as jest.MockedFunction<() => Promise<ValidatedData>>;
    getValidatedDataMock.mockResolvedValue({
      body: { domain: "example.com", bans: bansPayload },
      query: undefined,
      params: undefined,
      headers: undefined,
    });

    mockContext.env.ALLOWED_IPS = '';
    mockRequest.header.mockReturnValue("192.168.1.1");

    const response = await route.handle(mockContext);
    const result = await response.json() as ApiSuccessResponse<BansMap>;

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Successfully synced");
    expect(result.data).toEqual(bansPayload);
  });
});