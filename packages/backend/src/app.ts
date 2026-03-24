import Fastify from "fastify";
import { authRoutes } from "./auth/routes.js";
import { settingsRoutes } from "./settings/routes.js";
import { sessionRoutes } from "./session/routes.js";
import { memoryRoutes } from "./memory/routes.js";
import { syncRoutes } from "./sync/routes.js";
import { LLMGateway } from "./llm/gateway.js";

/** Singleton gateway instance shared across the app. */
let gateway: LLMGateway | null = null;

export function setGateway(g: LLMGateway): void {
  gateway = g;
}

export function getGateway(): LLMGateway | null {
  return gateway;
}

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/api/health", async (_request, _reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.get("/api/providers/stats", async (_request, _reply) => {
    if (!gateway) {
      return _reply.status(503).send({ error: "LLM Gateway not initialized" });
    }
    return gateway.getProviderStats();
  });

  await app.register(authRoutes);
  await app.register(settingsRoutes);
  await app.register(sessionRoutes);
  await app.register(memoryRoutes);
  await app.register(syncRoutes);

  return app;
}
