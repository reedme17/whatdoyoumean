import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, type TokenPayload } from "./jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

/**
 * Fastify preHandler hook that validates the Authorization bearer token.
 * Attach to routes or register globally for protected endpoints.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
  }
}
