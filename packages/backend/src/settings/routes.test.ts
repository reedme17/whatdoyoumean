import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { clearUsers } from "../auth/routes.js";
import { clearSettings } from "./routes.js";

/**
 * Helper: register a user and return an access token.
 */
async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "settings-user@example.com", password: "password123" },
  });
  return res.json().accessToken;
}

describe("Settings routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    clearUsers();
    clearSettings();
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // --- GET /api/settings ---

  describe("GET /api/settings", () => {
    it("returns default settings for a new user", async () => {
      const token = await getAccessToken(app);

      const res = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.userId).toBeDefined();
      expect(body.displayLanguage).toBe("en");
      expect(body.defaultAudioDevice).toBeNull();
      expect(body.preferredLLMProvider).toBe("cerebras");
      expect(body.sttModePreference).toBe("auto");
      expect(body.memoryStoragePreference).toBe("cloud");
      expect(body.memoryEnabled).toBe(true);
      expect(body.localProcessingOnly).toBe(false);
      expect(body.onboardingCompleted).toBe(false);
    });

    it("returns 401 without an auth token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/settings",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with an invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: { authorization: "Bearer invalid-token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // --- PUT /api/settings ---

  describe("PUT /api/settings", () => {
    it("updates specific settings fields", async () => {
      const token = await getAccessToken(app);

      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          displayLanguage: "zh",
          onboardingCompleted: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.displayLanguage).toBe("zh");
      expect(body.onboardingCompleted).toBe(true);
      // Unchanged fields keep defaults
      expect(body.memoryEnabled).toBe(true);
      expect(body.preferredLLMProvider).toBe("cerebras");
    });

    it("persists updates across GET requests", async () => {
      const token = await getAccessToken(app);

      await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: { authorization: `Bearer ${token}` },
        payload: { localProcessingOnly: true, memoryStoragePreference: "local" },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: { authorization: `Bearer ${token}` },
      });

      const body = res.json();
      expect(body.localProcessingOnly).toBe(true);
      expect(body.memoryStoragePreference).toBe("local");
    });

    it("ignores unknown fields and does not overwrite userId", async () => {
      const token = await getAccessToken(app);

      // First GET to capture the real userId
      const getRes = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: { authorization: `Bearer ${token}` },
      });
      const originalUserId = getRes.json().userId;

      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: { authorization: `Bearer ${token}` },
        payload: { userId: "hacker-id", unknownField: "nope", displayLanguage: "zh" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.userId).toBe(originalUserId);
      expect(body.displayLanguage).toBe("zh");
      expect((body as Record<string, unknown>).unknownField).toBeUndefined();
    });

    it("returns 401 without an auth token", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: { displayLanguage: "zh" },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
