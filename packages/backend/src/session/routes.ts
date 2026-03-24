/**
 * REST endpoints for session management and archive.
 */

import { FastifyInstance } from "fastify";
import { authenticate } from "../auth/middleware.js";
import { SessionArchiveService } from "./archive.js";

const archiveService = new SessionArchiveService();

export { archiveService };

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/sessions — list sessions for the authenticated user */
  app.get("/api/sessions", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    return reply.send(archiveService.list(userId));
  });

  /** GET /api/sessions/search?q=keyword — search sessions */
  app.get<{ Querystring: { q?: string } }>(
    "/api/sessions/search",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const keyword = request.query.q ?? "";
      if (!keyword) {
        return reply.code(400).send({ error: "Query parameter 'q' is required" });
      }
      return reply.send(archiveService.search(userId, keyword));
    },
  );

  /** GET /api/sessions/:id — get full session archive */
  app.get<{ Params: { id: string } }>(
    "/api/sessions/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const archive = archiveService.get(request.params.id);
      if (!archive) {
        return reply.code(404).send({ error: "Session not found" });
      }
      if (archive.session.userId !== request.user!.userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      return reply.send(archive);
    },
  );

  /** GET /api/sessions/:id/export — export session as markdown */
  app.get<{ Params: { id: string } }>(
    "/api/sessions/:id/export",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const archive = archiveService.get(request.params.id);
      if (!archive) {
        return reply.code(404).send({ error: "Session not found" });
      }
      if (archive.session.userId !== request.user!.userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const md = archiveService.export(request.params.id);
      return reply.type("text/markdown").send(md);
    },
  );

  /** DELETE /api/sessions/:id — delete session */
  app.delete<{ Params: { id: string } }>(
    "/api/sessions/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const archive = archiveService.get(request.params.id);
      if (!archive) {
        return reply.code(404).send({ error: "Session not found" });
      }
      if (archive.session.userId !== request.user!.userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      archiveService.delete(request.params.id);
      return reply.code(204).send();
    },
  );
}
