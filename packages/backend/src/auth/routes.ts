import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { generateTokenPair, verifyRefreshToken } from "./jwt.js";

/**
 * In-memory user store — will be replaced with PostgreSQL in a later task.
 */
interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  authProvider: "email" | "apple" | "google";
  createdAt: Date;
  lastLoginAt: Date;
}

const users = new Map<string, StoredUser>();

interface RegisterBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/register
   */
  app.post<{ Body: RegisterBody }>("/api/auth/register", async (request, reply) => {
    const { email, password } = request.body ?? {};

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    if (users.has(email)) {
      return reply.code(409).send({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const user: StoredUser = {
      id: randomUUID(),
      email,
      passwordHash,
      authProvider: "email",
      createdAt: now,
      lastLoginAt: now,
    };

    users.set(email, user);

    const tokens = generateTokenPair({ userId: user.id, email: user.email });

    return reply.code(201).send({
      user: { id: user.id, email: user.email, authProvider: user.authProvider },
      ...tokens,
    });
  });

  /**
   * POST /api/auth/login
   */
  app.post<{ Body: LoginBody }>("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body ?? {};

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const user = users.get(email);
    if (!user) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();

    const tokens = generateTokenPair({ userId: user.id, email: user.email });

    return reply.send({
      user: { id: user.id, email: user.email, authProvider: user.authProvider },
      ...tokens,
    });
  });

  /**
   * POST /api/auth/refresh
   */
  app.post<{ Body: RefreshBody }>("/api/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body ?? {};

    if (!refreshToken) {
      return reply.code(400).send({ error: "Refresh token is required" });
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const tokens = generateTokenPair({
        userId: payload.userId,
        email: payload.email,
      });
      return reply.send(tokens);
    } catch {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }
  });

  // --- OAuth 2.0 stubs ---

  /**
   * POST /api/auth/oauth/apple
   * TODO: Implement Apple Sign-In OAuth 2.0 flow
   * - Validate Apple identity token
   * - Create or find user by Apple subject ID
   * - Return JWT token pair
   */
  app.post("/api/auth/oauth/apple", async (_request, reply) => {
    return reply.code(501).send({
      error: "Apple Sign-In not yet implemented",
    });
  });

  /**
   * POST /api/auth/oauth/google
   * TODO: Implement Google OAuth 2.0 flow
   * - Validate Google ID token
   * - Create or find user by Google subject ID
   * - Return JWT token pair
   */
  app.post("/api/auth/oauth/google", async (_request, reply) => {
    return reply.code(501).send({
      error: "Google Sign-In not yet implemented",
    });
  });
}

/**
 * Exported for testing — clears the in-memory user store.
 */
export function clearUsers(): void {
  users.clear();
}
