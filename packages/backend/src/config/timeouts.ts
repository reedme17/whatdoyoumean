function readTimeoutMs(envVar: string, fallbackMs: number): number {
  const raw = process.env[envVar];
  if (!raw) return fallbackMs;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

export const DEFAULT_LLM_TIMEOUT_MS = readTimeoutMs("LLM_DEFAULT_TIMEOUT_MS", 5000);
export const RECOMMENDATION_TIMEOUT_MS = readTimeoutMs("LLM_RECOMMENDATION_TIMEOUT_MS", 6000);
export const SUMMARY_TIMEOUT_MS = readTimeoutMs("LLM_SUMMARY_TIMEOUT_MS", 10000);
