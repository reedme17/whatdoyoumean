/**
 * REST endpoints for data synchronization.
 */

import { FastifyInstance } from "fastify";
import { authenticate } from "../auth/middleware.js";
import { SyncService } from "./service.js";

const syncService = new SyncService();

export { syncService };

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/sync/push — push local changes */
  app.post<{ Body: { sessionId: string; localVersion: number } }>(
    "/api/sync/push",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { sessionId, localVersion } = request.body ?? {};
      if (!sessionId || localVersion === undefined) {
        return reply.code(400).send({ error: "sessionId and localVersion are required" });
      }
      const record = syncService.push({ userId, sessionId, localVersion });
      return reply.send(record);
    },
  );

  /** POST /api/sync/pull — pull remote changes */
  app.post("/api/sync/pull", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const records = syncService.pull({ userId });
    return reply.send(records);
  });

  /** POST /api/sync/resolve — resolve sync conflict */
  app.post<{ Body: { syncId: string; resolution: "local" | "remote" } }>(
    "/api/sync/resolve",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { syncId, resolution } = request.body ?? {};
      if (!syncId || !resolution) {
        return reply.code(400).send({ error: "syncId and resolution are required" });
      }
      if (resolution !== "local" && resolution !== "remote") {
        return reply.code(400).send({ error: "resolution must be 'local' or 'remote'" });
      }
      const record = syncService.resolve({ syncId, resolution });
      if (!record) {
        return reply.code(404).send({ error: "Sync record not found or not in conflict" });
      }
      return reply.send(record);
    },
  );
}
