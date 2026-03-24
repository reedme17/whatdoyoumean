import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { clearUsers } from "./routes.js";
import { verifyAccessToken, verifyRefreshToken } from "./jwt.js";

describe("Auth routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    clearUsers();
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // --- Register ---

  describe("POST /api/auth/register", () => {
    it("creates a new user and returns tokens", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "test@example.com", password: "password123" },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.user.email).toBe("test@example.com");
      expect(body.user.authProvider).toBe("email");
      expect(body.user.id).toBeDefined();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // Tokens should be valid
      const payload = verifyAccessToken(body.accessToken);
      expect(payload.email).toBe("test@example.com");
    });

    it("returns 400 when email or password is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "test@example.com" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 409 when user already exists", async () => {
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "dup@example.com", password: "pass" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "dup@example.com", password: "pass" },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  // --- Login ---

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "user@example.com", password: "secret" },
      });
    });

    it("returns tokens for valid credentials", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "user@example.com", password: "secret" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe("user@example.com");
    });

    it("returns 401 for wrong password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "user@example.com", password: "wrong" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 for non-existent user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "nobody@example.com", password: "secret" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // --- Refresh ---

  describe("POST /api/auth/refresh", () => {
    it("returns a new token pair for a valid refresh token", async () => {
      const regRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "refresh@example.com", password: "pass" },
      });
      const { refreshToken } = regRes.json();

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // New tokens should be valid
      const payload = verifyRefreshToken(body.refreshToken);
      expect(payload.email).toBe("refresh@example.com");
    });

    it("returns 401 for an invalid refresh token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken: "garbage-token" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when refresh token is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // --- OAuth stubs ---

  describe("OAuth stubs", () => {
    it("POST /api/auth/oauth/apple returns 501", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/oauth/apple",
      });
      expect(res.statusCode).toBe(501);
    });

    it("POST /api/auth/oauth/google returns 501", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/oauth/google",
      });
      expect(res.statusCode).toBe(501);
    });
  });
});
