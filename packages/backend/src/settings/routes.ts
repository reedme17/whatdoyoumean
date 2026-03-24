import { FastifyInstance } from "fastify";
import { authenticate } from "../auth/middleware.js";
import type { UserSettings } from "@wdym/shared";

/**
 * In-memory settings store keyed by userId — will be replaced with PostgreSQL later.
 */
const settingsStore = new Map<string, UserSettings>();

function defaultSettings(userId: string): UserSettings {
  return {
    userId,
    displayLanguage: "en",
    defaultAudioDevice: null,
    preferredLLMProvider: "cerebras",
    sttModePreference: "auto",
    memoryStoragePreference: "cloud",
    memoryEnabled: true,
    localProcessingOnly: false,
    onboardingCompleted: false,
  };
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/settings — return the authenticated user's settings.
   * Creates default settings on first access.
   */
  app.get("/api/settings", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;

    if (!settingsStore.has(userId)) {
      settingsStore.set(userId, defaultSettings(userId));
    }

    return reply.send(settingsStore.get(userId));
  });

  /**
   * PUT /api/settings — update the authenticated user's settings.
   * Only provided fields are updated (partial update / merge).
   */
  app.put<{ Body: Partial<Omit<UserSettings, "userId">> }>(
    "/api/settings",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const body = request.body ?? {};

      const current = settingsStore.get(userId) ?? defaultSettings(userId);

      const updatable: (keyof Omit<UserSettings, "userId">)[] = [
        "displayLanguage",
        "defaultAudioDevice",
        "preferredLLMProvider",
        "sttModePreference",
        "memoryStoragePreference",
        "memoryEnabled",
        "localProcessingOnly",
        "onboardingCompleted",
      ];

      for (const key of updatable) {
        if (key in body && body[key] !== undefined) {
          (current as unknown as Record<string, unknown>)[key] = body[key];
        }
      }

      settingsStore.set(userId, current);

      return reply.send(current);
    },
  );
}

/**
 * Exported for testing — clears the in-memory settings store.
 */
export function clearSettings(): void {
  settingsStore.clear();
}
