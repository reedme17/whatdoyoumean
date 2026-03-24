import { describe, it, expect, beforeEach, vi } from "vitest";
import { PerformanceMonitor } from "./monitor.js";

describe("PerformanceMonitor", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  // ── Budget defaults ──

  it("has correct default budgets", () => {
    expect(monitor.getBudget("stt")).toBe(1000);
    expect(monitor.getBudget("semantic")).toBe(3000);
    expect(monitor.getBudget("recommendation")).toBe(2000);
    expect(monitor.getBudget("visualization")).toBe(500);
  });

  it("accepts custom budgets", () => {
    const custom = new PerformanceMonitor({ stt: 500 });
    expect(custom.getBudget("stt")).toBe(500);
    expect(custom.getBudget("semantic")).toBe(3000); // default preserved
  });

  // ── Recording ──

  it("records latency within budget", () => {
    const rec = monitor.record("stt", 800);
    expect(rec.exceeded).toBe(false);
    expect(rec.subsystem).toBe("stt");
    expect(rec.durationMs).toBe(800);
  });

  it("records latency exceeding budget", () => {
    const rec = monitor.record("stt", 1500);
    expect(rec.exceeded).toBe(true);
  });

  it("fires warning callback when budget exceeded", () => {
    const cb = vi.fn();
    monitor.onWarning = cb;
    monitor.record("visualization", 600);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].subsystem).toBe("visualization");
    expect(cb.mock.calls[0][0].durationMs).toBe(600);
    expect(cb.mock.calls[0][0].budgetMs).toBe(500);
  });

  it("does not fire warning when within budget", () => {
    const cb = vi.fn();
    monitor.onWarning = cb;
    monitor.record("semantic", 2000);
    expect(cb).not.toHaveBeenCalled();
  });

  // ── Metrics ──

  it("computes metrics correctly", () => {
    monitor.record("stt", 200);
    monitor.record("stt", 400);
    monitor.record("stt", 1200); // exceeds

    const m = monitor.getMetricsFor("stt")!;
    expect(m.totalCalls).toBe(3);
    expect(m.totalExceeded).toBe(1);
    expect(m.avgDurationMs).toBe(600); // (200+400+1200)/3 = 600
    expect(m.maxDurationMs).toBe(1200);
    expect(m.minDurationMs).toBe(200);
    expect(m.lastDurationMs).toBe(1200);
  });

  it("returns zero metrics for unused subsystem", () => {
    const m = monitor.getMetricsFor("recommendation")!;
    expect(m.totalCalls).toBe(0);
    expect(m.avgDurationMs).toBe(0);
    expect(m.lastDurationMs).toBeNull();
  });

  it("returns all subsystem metrics", () => {
    const all = monitor.getMetrics();
    expect(all).toHaveLength(4);
    const names = all.map((m) => m.subsystem);
    expect(names).toContain("stt");
    expect(names).toContain("semantic");
    expect(names).toContain("recommendation");
    expect(names).toContain("visualization");
  });

  // ── Warnings ──

  it("accumulates warnings", () => {
    monitor.record("stt", 1500);
    monitor.record("visualization", 800);
    expect(monitor.getWarnings()).toHaveLength(2);
  });

  it("warning messages include subsystem and timing", () => {
    monitor.record("semantic", 5000);
    const w = monitor.getWarnings()[0];
    expect(w.message).toContain("semantic");
    expect(w.message).toContain("5000");
    expect(w.message).toContain("3000");
  });

  // ── Measure wrapper ──

  it("measures async operation latency", async () => {
    const { result, record } = await monitor.measure("semantic", async () => {
      return "card";
    });
    expect(result).toBe("card");
    expect(record.subsystem).toBe("semantic");
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(monitor.getMetricsFor("semantic")!.totalCalls).toBe(1);
  });

  // ── Reset ──

  it("resets all metrics and warnings", () => {
    monitor.record("stt", 1500);
    monitor.record("semantic", 100);
    monitor.reset();

    expect(monitor.getMetricsFor("stt")!.totalCalls).toBe(0);
    expect(monitor.getMetricsFor("semantic")!.totalCalls).toBe(0);
    expect(monitor.getWarnings()).toHaveLength(0);
  });
});
