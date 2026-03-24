/**
 * REST endpoints for conversation memory.
 */

import { FastifyInstance } from "fastify";
import { authenticate } from "../auth/middleware.js";
import { ConversationMemoryService } from "./service.js";

const memoryService = new ConversationMemoryService();

export { memoryService };

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/memory — get all memory entries for the user */
  app.get("/api/memory", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    return reply.send(memoryService.getAll(userId));
  });

  /** GET /api/memory/profile — get user profile */
  app.get("/api/memory/profile", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    return reply.send(memoryService.getUserProfile(userId));
  });

  /** DELETE /api/memory/:entryId — delete a specific memory entry */
  app.delete<{ Params: { entryId: string } }>(
    "/api/memory/:entryId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const deleted = memoryService.deleteEntry(userId, request.params.entryId);
      if (!deleted) {
        return reply.code(404).send({ error: "Memory entry not found" });
      }
      return reply.code(204).send();
    },
  );

  /** DELETE /api/memory — clear all memory for the user */
  app.delete("/api/memory", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    memoryService.clearAll(userId);
    return reply.code(204).send();
  });
}
