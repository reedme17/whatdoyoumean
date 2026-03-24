import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { buildApp, setGateway } from "./app.js";
import { LLMGateway } from "./llm/gateway.js";

describe("GET /api/health", () => {
  const app = buildApp();

  afterAll(async () => {
    await (await app).close();
  });

  it("returns status ok with a timestamp", async () => {
    const server = await app;
    const response = await server.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    // Verify timestamp is a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});

describe("GET /api/providers/stats", () => {
  it("returns 503 when gateway is not initialized", async () => {
    setGateway(null as unknown as LLMGateway);
    const server = await buildApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/providers/stats",
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe("LLM Gateway not initialized");
    } finally {
      await server.close();
    }
  });

  it("returns provider stats when gateway is initialized", async () => {
    const gateway = new LLMGateway();
    setGateway(gateway);
    const server = await buildApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/providers/stats",
      });
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    } finally {
      await server.close();
    }
  });
});
