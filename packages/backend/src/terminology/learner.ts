/**
 * Terminology_Learner — multi-stage post-processing pipeline that
 * automatically learns domain-specific terminology by comparing raw ASR
 * output with LLM-refined text. Maintains a per-user dictionary for
 * acronym folding, token merging, entity correction, and case normalization.
 */

// ── public types ─────────────────────────────────────────────────

export interface TermEntry {
  id: string;
  userId: string;
  term: string;
  variants: string[];
  frequency: number;
  source: "auto_learned" | "user_added";
  createdAt: Date;
}

export interface Correction {
  original: string;
  corrected: string;
  rule:
    | "acronym_folding"
    | "token_merge"
    | "entity_correction"
    | "case_normalization"
    | "dictionary_match";
}

export interface PostProcessResult {
  correctedText: string;
  appliedCorrections: Correction[];
}

// ── built-in rules ───────────────────────────────────────────────

/**
 * Common acronyms that ASR engines tend to spell out letter-by-letter.
 * Maps the spaced-out form to the correct acronym.
 */
const BUILTIN_ACRONYMS: Record<string, string> = {
  "a p i": "API",
  "u r l": "URL",
  "h t t p": "HTTP",
  "h t t p s": "HTTPS",
  "s q l": "SQL",
  "c s s": "CSS",
  "h t m l": "HTML",
  "j s o n": "JSON",
  "r e s t": "REST",
  "s d k": "SDK",
  "c l i": "CLI",
  "u i": "UI",
  "u x": "UX",
  "a i": "AI",
  "m l": "ML",
  "i o": "IO",
  "d b": "DB",
};

// ── TerminologyLearner ───────────────────────────────────────────

export class TerminologyLearner {
  /** Per-user dictionaries: userId → TermEntry[] */
  private dictionaries = new Map<string, TermEntry[]>();

  /**
   * Multi-stage post-processing pipeline applied to raw ASR text.
   * Stages: acronym folding → token merging → dictionary match → case normalization
   */
  postProcess(rawText: string, userId: string): PostProcessResult {
    const corrections: Correction[] = [];
    let text = rawText;

    // Stage 1: Acronym folding ("A P I" → "API")
    text = this.applyAcronymFolding(text, corrections);

    // Stage 2: Token merging (e.g., "micro services" → "microservices")
    text = this.applyTokenMerging(text, corrections);

    // Stage 3: Dictionary match — apply user's learned terms
    text = this.applyDictionaryMatch(text, userId, corrections);

    // Stage 4: Case normalization for known entities
    text = this.applyCaseNormalization(text, userId, corrections);

    return { correctedText: text, appliedCorrections: corrections };
  }

  /**
   * Compare raw ASR output with LLM-refined text and extract candidate
   * terminology entries. Words that differ between the two are candidates.
   */
  learnFromDiff(
    rawASROutput: string,
    llmRefinedOutput: string,
    userId: string,
  ): TermEntry[] {
    const rawTokens = tokenize(rawASROutput);
    const refinedTokens = tokenize(llmRefinedOutput);
    const learned: TermEntry[] = [];

    // Find tokens present in refined but not in raw (corrections the LLM made)
    const rawLower = new Set(rawTokens.map((t) => t.toLowerCase()));
    const refinedLower = new Set(refinedTokens.map((t) => t.toLowerCase()));

    for (const token of refinedTokens) {
      const lower = token.toLowerCase();
      if (lower.length < 2) continue;
      if (rawLower.has(lower)) continue;

      // Find what the raw text had instead — look for similar tokens
      const rawVariant = findClosestVariant(token, rawTokens);
      if (!rawVariant) continue;

      // Check if we already have this term
      const dict = this.getDictionary(userId);
      const existing = dict.find(
        (e) => e.term.toLowerCase() === lower,
      );

      if (existing) {
        // Add variant if new
        if (
          !existing.variants
            .map((v) => v.toLowerCase())
            .includes(rawVariant.toLowerCase())
        ) {
          existing.variants.push(rawVariant);
        }
        existing.frequency++;
      } else {
        const entry: TermEntry = {
          id: generateId(),
          userId,
          term: token,
          variants: [rawVariant],
          frequency: 1,
          source: "auto_learned",
          createdAt: new Date(),
        };
        dict.push(entry);
        learned.push(entry);
      }
    }

    return learned;
  }

  // ── dictionary management ────────────────────────────────────

  getDictionary(userId: string): TermEntry[] {
    if (!this.dictionaries.has(userId)) {
      this.dictionaries.set(userId, []);
    }
    return this.dictionaries.get(userId)!;
  }

  addTerm(userId: string, term: Omit<TermEntry, "id" | "createdAt">): TermEntry {
    const entry: TermEntry = {
      ...term,
      id: generateId(),
      userId,
      createdAt: new Date(),
    };
    this.getDictionary(userId).push(entry);
    return entry;
  }

  removeTerm(userId: string, termId: string): boolean {
    const dict = this.getDictionary(userId);
    const idx = dict.findIndex((e) => e.id === termId);
    if (idx === -1) return false;
    dict.splice(idx, 1);
    return true;
  }

  getEntry(userId: string, termId: string): TermEntry | undefined {
    return this.getDictionary(userId).find((e) => e.id === termId);
  }

  // ── post-processing stages ───────────────────────────────────

  private applyAcronymFolding(
    text: string,
    corrections: Correction[],
  ): string {
    let result = text;
    // Sort by length descending so longer acronyms match first
    // (e.g., "h t t p s" before "h t t p")
    const sorted = Object.entries(BUILTIN_ACRONYMS).sort(
      (a, b) => b[0].length - a[0].length,
    );
    for (const [spaced, acronym] of sorted) {
      const regex = new RegExp(`\\b${escapeRegex(spaced)}\\b`, "gi");
      if (regex.test(result)) {
        // Reset lastIndex since we used .test() which advances it
        regex.lastIndex = 0;
        result = result.replace(regex, acronym);
        corrections.push({
          original: spaced,
          corrected: acronym,
          rule: "acronym_folding",
        });
      }
    }
    return result;
  }

  private applyTokenMerging(
    text: string,
    corrections: Correction[],
  ): string {
    // Common compound words that ASR splits
    const merges: [RegExp, string][] = [
      [/\bmicro\s+services?\b/gi, "microservices"],
      [/\bdata\s+base\b/gi, "database"],
      [/\bweb\s+socket\b/gi, "WebSocket"],
      [/\btype\s+script\b/gi, "TypeScript"],
      [/\bjava\s+script\b/gi, "JavaScript"],
      [/\bpost\s+gres\b/gi, "Postgres"],
    ];

    let result = text;
    for (const [pattern, merged] of merges) {
      const match = result.match(pattern);
      if (match) {
        result = result.replace(pattern, merged);
        corrections.push({
          original: match[0],
          corrected: merged,
          rule: "token_merge",
        });
      }
    }
    return result;
  }

  private applyDictionaryMatch(
    text: string,
    userId: string,
    corrections: Correction[],
  ): string {
    const dict = this.getDictionary(userId);
    let result = text;

    for (const entry of dict) {
      for (const variant of entry.variants) {
        const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, "gi");
        if (regex.test(result)) {
          result = result.replace(regex, entry.term);
          corrections.push({
            original: variant,
            corrected: entry.term,
            rule: "dictionary_match",
          });
        }
      }
    }
    return result;
  }

  private applyCaseNormalization(
    text: string,
    userId: string,
    corrections: Correction[],
  ): string {
    const dict = this.getDictionary(userId);
    let result = text;

    for (const entry of dict) {
      // Fix case mismatches for the canonical term itself
      const regex = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, "gi");
      const matches = result.match(regex);
      if (matches) {
        for (const match of matches) {
          if (match !== entry.term) {
            result = result.replace(match, entry.term);
            corrections.push({
              original: match,
              corrected: entry.term,
              rule: "case_normalization",
            });
          }
        }
      }
    }
    return result;
  }
}

// ── utilities ────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Find the closest variant in rawTokens for a given refined token.
 * Uses simple edit-distance heuristic: tokens that share a common prefix
 * of at least 60% length are considered variants.
 */
function findClosestVariant(
  refinedToken: string,
  rawTokens: string[],
): string | null {
  const rLower = refinedToken.toLowerCase();
  const minPrefix = Math.max(2, Math.floor(rLower.length * 0.6));

  for (const raw of rawTokens) {
    const tLower = raw.toLowerCase();
    if (tLower === rLower) continue; // exact match = not a variant

    // Check common prefix length
    let common = 0;
    for (let i = 0; i < Math.min(rLower.length, tLower.length); i++) {
      if (rLower[i] === tLower[i]) common++;
      else break;
    }
    if (common >= minPrefix) return raw;
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let idCounter = 0;
function generateId(): string {
  return `term_${Date.now()}_${++idCounter}`;
}
