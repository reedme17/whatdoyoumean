import { describe, it, expect, beforeEach } from "vitest";
import {
  TerminologyLearner,
  type TermEntry,
  type PostProcessResult,
} from "./learner.js";

// ── tests ────────────────────────────────────────────────────────

describe("TerminologyLearner", () => {
  let learner: TerminologyLearner;
  const userId = "user-1";

  beforeEach(() => {
    learner = new TerminologyLearner();
  });

  // ── postProcess: acronym folding ─────────────────────────────

  describe("postProcess — acronym folding", () => {
    it('folds "A P I" into "API"', () => {
      const result = learner.postProcess("We need a new a p i endpoint", userId);
      expect(result.correctedText).toContain("API");
      expect(result.appliedCorrections).toContainEqual(
        expect.objectContaining({ rule: "acronym_folding", corrected: "API" }),
      );
    });

    it('folds "h t t p s" into "HTTPS"', () => {
      const result = learner.postProcess("Use h t t p s for security", userId);
      expect(result.correctedText).toContain("HTTPS");
    });

    it("is case-insensitive for acronym detection", () => {
      const result = learner.postProcess("The U R L is broken", userId);
      expect(result.correctedText).toContain("URL");
    });

    it("handles multiple acronyms in one string", () => {
      const result = learner.postProcess(
        "The a p i returns j s o n data",
        userId,
      );
      expect(result.correctedText).toContain("API");
      expect(result.correctedText).toContain("JSON");
    });
  });

  // ── postProcess: token merging ───────────────────────────────

  describe("postProcess — token merging", () => {
    it('merges "micro services" into "microservices"', () => {
      const result = learner.postProcess(
        "We use micro services architecture",
        userId,
      );
      expect(result.correctedText).toContain("microservices");
      expect(result.appliedCorrections).toContainEqual(
        expect.objectContaining({ rule: "token_merge" }),
      );
    });

    it('merges "type script" into "TypeScript"', () => {
      const result = learner.postProcess("Written in type script", userId);
      expect(result.correctedText).toContain("TypeScript");
    });

    it('merges "java script" into "JavaScript"', () => {
      const result = learner.postProcess("Using java script framework", userId);
      expect(result.correctedText).toContain("JavaScript");
    });
  });

  // ── postProcess: dictionary match ────────────────────────────

  describe("postProcess — dictionary match", () => {
    it("corrects known variants from user dictionary", () => {
      learner.addTerm(userId, {
        userId,
        term: "PostgreSQL",
        variants: ["post gress", "postgres q l"],
        frequency: 5,
        source: "user_added",
      });

      const result = learner.postProcess(
        "We migrated to post gress last week",
        userId,
      );
      expect(result.correctedText).toContain("PostgreSQL");
      expect(result.appliedCorrections).toContainEqual(
        expect.objectContaining({
          rule: "dictionary_match",
          corrected: "PostgreSQL",
        }),
      );
    });

    it("does not modify text when no dictionary entries match", () => {
      const input = "This is a normal sentence";
      const result = learner.postProcess(input, userId);
      expect(result.correctedText).toBe(input);
    });
  });

  // ── postProcess: case normalization ──────────────────────────

  describe("postProcess — case normalization", () => {
    it("normalizes case for known terms", () => {
      learner.addTerm(userId, {
        userId,
        term: "GraphQL",
        variants: [],
        frequency: 3,
        source: "user_added",
      });

      const result = learner.postProcess("We should use graphql", userId);
      expect(result.correctedText).toContain("GraphQL");
      expect(result.appliedCorrections).toContainEqual(
        expect.objectContaining({ rule: "case_normalization" }),
      );
    });
  });

  // ── postProcess: multi-stage pipeline ────────────────────────

  describe("postProcess — full pipeline", () => {
    it("applies all stages in sequence", () => {
      learner.addTerm(userId, {
        userId,
        term: "Kubernetes",
        variants: ["kuber netes"],
        frequency: 2,
        source: "auto_learned",
      });

      const result = learner.postProcess(
        "Deploy the a p i to kuber netes using type script",
        userId,
      );

      expect(result.correctedText).toContain("API");
      expect(result.correctedText).toContain("Kubernetes");
      expect(result.correctedText).toContain("TypeScript");
      expect(result.appliedCorrections.length).toBeGreaterThanOrEqual(3);
    });

    it("returns unchanged text when no corrections apply", () => {
      const input = "Hello world";
      const result = learner.postProcess(input, userId);
      expect(result.correctedText).toBe(input);
      expect(result.appliedCorrections).toEqual([]);
    });
  });

  // ── learnFromDiff ────────────────────────────────────────────

  describe("learnFromDiff()", () => {
    it("extracts candidate terms from ASR vs LLM differences", () => {
      const raw = "We should use kubernets for deployment";
      const refined = "We should use Kubernetes for deployment";

      const learned = learner.learnFromDiff(raw, refined, userId);

      expect(learned.length).toBeGreaterThanOrEqual(1);
      const k8s = learned.find((e) => e.term === "Kubernetes");
      expect(k8s).toBeDefined();
      expect(k8s!.variants).toContain("kubernets");
      expect(k8s!.source).toBe("auto_learned");
    });

    it("increments frequency for already-known terms", () => {
      learner.addTerm(userId, {
        userId,
        term: "Kubernetes",
        variants: ["kubernets"],
        frequency: 1,
        source: "auto_learned",
      });

      learner.learnFromDiff(
        "Deploy to kubernets",
        "Deploy to Kubernetes",
        userId,
      );

      const dict = learner.getDictionary(userId);
      const entry = dict.find((e) => e.term === "Kubernetes");
      expect(entry!.frequency).toBe(2);
    });

    it("adds new variant to existing term", () => {
      learner.addTerm(userId, {
        userId,
        term: "Kubernetes",
        variants: ["kubernets"],
        frequency: 1,
        source: "auto_learned",
      });

      learner.learnFromDiff(
        "Deploy to kubernetis cluster",
        "Deploy to Kubernetes cluster",
        userId,
      );

      const dict = learner.getDictionary(userId);
      const entry = dict.find((e) => e.term === "Kubernetes");
      expect(entry!.variants).toContain("kubernetis");
    });

    it("ignores very short tokens (< 2 chars)", () => {
      const learned = learner.learnFromDiff("a b c", "x y z", userId);
      expect(learned).toEqual([]);
    });
  });

  // ── dictionary management ────────────────────────────────────

  describe("dictionary management", () => {
    it("getDictionary returns empty array for new user", () => {
      expect(learner.getDictionary("new-user")).toEqual([]);
    });

    it("addTerm adds entry to user dictionary", () => {
      const entry = learner.addTerm(userId, {
        userId,
        term: "React",
        variants: ["react js"],
        frequency: 1,
        source: "user_added",
      });

      expect(entry.id).toBeTruthy();
      expect(entry.term).toBe("React");
      expect(learner.getDictionary(userId)).toContainEqual(entry);
    });

    it("removeTerm removes entry by id", () => {
      const entry = learner.addTerm(userId, {
        userId,
        term: "Vue",
        variants: [],
        frequency: 1,
        source: "user_added",
      });

      expect(learner.removeTerm(userId, entry.id)).toBe(true);
      expect(learner.getDictionary(userId)).not.toContainEqual(entry);
    });

    it("removeTerm returns false for non-existent id", () => {
      expect(learner.removeTerm(userId, "nonexistent")).toBe(false);
    });

    it("getEntry retrieves a specific entry", () => {
      const entry = learner.addTerm(userId, {
        userId,
        term: "Docker",
        variants: ["docker"],
        frequency: 1,
        source: "user_added",
      });

      expect(learner.getEntry(userId, entry.id)).toEqual(entry);
    });

    it("getEntry returns undefined for non-existent entry", () => {
      expect(learner.getEntry(userId, "nope")).toBeUndefined();
    });

    it("maintains separate dictionaries per user", () => {
      learner.addTerm("user-a", {
        userId: "user-a",
        term: "TermA",
        variants: [],
        frequency: 1,
        source: "user_added",
      });
      learner.addTerm("user-b", {
        userId: "user-b",
        term: "TermB",
        variants: [],
        frequency: 1,
        source: "user_added",
      });

      expect(learner.getDictionary("user-a")).toHaveLength(1);
      expect(learner.getDictionary("user-a")[0].term).toBe("TermA");
      expect(learner.getDictionary("user-b")).toHaveLength(1);
      expect(learner.getDictionary("user-b")[0].term).toBe("TermB");
    });
  });
});
