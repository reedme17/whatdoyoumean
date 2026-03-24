/**
 * Performance monitor — tracks latency budgets and logs warnings.
 *
 * Latency budgets (from Requirements 18.1–18.4):
 *   STT interim      < 1000ms
 *   Semantic analysis < 3000ms
 *   Recommendations   < 2000ms
 *   Visualization     <  500ms
 *
 * Exposes GET /api/performance/metrics endpoint via Fastify plugin.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9
 */

import type { FastifyInstance } from "fastify";

export type Subsystem = "stt" | "semantic" | "recommendation" | "visualization";

export interface LatencyBudget {
  subsystem: Subsystem;
  budgetMs: number;
}

export interface LatencyRecord {
  subsystem: Subsystem;
  durationMs: number;
  timestamp: number;
  exceeded: boolean;
}

export interface SubsystemMetrics {
  subsystem: Subsystem;
  budgetMs: number;
  totalCalls: number;
  totalExceeded: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  lastDurationMs: number | null;
}

export interface PerformanceWarning {
  subsystem: Subsystem;
  durationMs: number;
  budgetMs: number;
  timestamp: string;
  message: string;
}

const DEFAULT_BUDGETS: Record<Subsystem, number> = {
  stt: 1000,
  semantic: 3000,
  recommendation: 2000,
  visualization: 500,
};

export class PerformanceMonitor {
  private budgets: Record<Subsystem, number>;
  private records: Map<Subsystem, { total: number; exceeded: number; sumMs: number; maxMs: number; minMs: number; lastMs: number | null }>;
  private warnings: PerformanceWarning[] = [];

  /** Callback for budget exceeded warnings */
  onWarning: ((warning: PerformanceWarning) => void) | null = null;

  constructor(budgets?: Partial<Record<Subsystem, number>>) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets };
    this.records = new Map();
    for (const sub of Object.keys(this.budgets) as Subsystem[]) {
      this.records.set(sub, { total: 0, exceeded: 0, sumMs: 0, maxMs: 0, minMs: Infinity, lastMs: null });
    }
  }

  /**
   * Record a latency measurement for a subsystem.
   * Logs a warning if the budget is exceeded.
   */
  record(subsystem: Subsystem, durationMs: number): LatencyRecord {
    const budget = this.budgets[subsystem];
    const exceeded = durationMs > budget;

    const stats = this.records.get(subsystem);
    if (stats) {
      stats.total++;
      stats.sumMs += durationMs;
      stats.lastMs = durationMs;
      if (durationMs > stats.maxMs) stats.maxMs = durationMs;
      if (durationMs < stats.minMs) stats.minMs = durationMs;
      if (exceeded) stats.exceeded++;
    }

    if (exceeded) {
      const warning: PerformanceWarning = {
        subsystem,
        durationMs,
        budgetMs: budget,
        timestamp: new Date().toISOString(),
        message: `${subsystem} exceeded budget: ${durationMs}ms > ${budget}ms`,
      };
      this.warnings.push(warning);
      this.onWarning?.(warning);
    }

    return { subsystem, durationMs, timestamp: Date.now(), exceeded };
  }

  /**
   * Wrap an async operation and automatically record its latency.
   */
  async measure<T>(subsystem: Subsystem, operation: () => Promise<T>): Promise<{ result: T; record: LatencyRecord }> {
    const start = Date.now();
    const result = await operation();
    const durationMs = Date.now() - start;
    const rec = this.record(subsystem, durationMs);
    return { result, record: rec };
  }

  /**
   * Get metrics for all subsystems.
   */
  getMetrics(): SubsystemMetrics[] {
    const result: SubsystemMetrics[] = [];
    for (const [subsystem, stats] of this.records) {
      result.push({
        subsystem,
        budgetMs: this.budgets[subsystem],
        totalCalls: stats.total,
        totalExceeded: stats.exceeded,
        avgDurationMs: stats.total > 0 ? Math.round(stats.sumMs / stats.total) : 0,
        maxDurationMs: stats.total > 0 ? stats.maxMs : 0,
        minDurationMs: stats.total > 0 ? stats.minMs : 0,
        lastDurationMs: stats.lastMs,
      });
    }
    return result;
  }

  /**
   * Get metrics for a specific subsystem.
   */
  getMetricsFor(subsystem: Subsystem): SubsystemMetrics | undefined {
    return this.getMetrics().find((m) => m.subsystem === subsystem);
  }

  /**
   * Get all recorded warnings.
   */
  getWarnings(): PerformanceWarning[] {
    return [...this.warnings];
  }

  /**
   * Get the budget for a subsystem.
   */
  getBudget(subsystem: Subsystem): number {
    return this.budgets[subsystem];
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    for (const stats of this.records.values()) {
      stats.total = 0;
      stats.exceeded = 0;
      stats.sumMs = 0;
      stats.maxMs = 0;
      stats.minMs = Infinity;
      stats.lastMs = null;
    }
    this.warnings = [];
  }
}

/**
 * Register the GET /api/performance/metrics endpoint on a Fastify instance.
 */
export function performanceRoutes(monitor: PerformanceMonitor) {
  return async function (app: FastifyInstance) {
    app.get("/api/performance/metrics", async (_request, _reply) => {
      return {
        metrics: monitor.getMetrics(),
        warnings: monitor.getWarnings(),
        timestamp: new Date().toISOString(),
      };
    });
  };
}
