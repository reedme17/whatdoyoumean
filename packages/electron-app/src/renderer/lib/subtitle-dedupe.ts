function normalizeLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/[|[\](){}]/g, " ")
    .replace(/[.,!?;:]+$/g, "")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

function normalizeText(text: string): string {
  return text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeNormalized(text: string): string[] {
  return text.split(" ").map((token) => token.trim()).filter(Boolean);
}

export interface SubtitleMergeResult {
  appendedText: string;
  mergedScript: string;
  captureLines: string[];
}

export function mergeSubtitleCapture(
  existingScript: string,
  captureText: string,
): SubtitleMergeResult {
  const existingLines = cleanLines(existingScript);
  const captureLines = cleanLines(captureText);
  const existingText = cleanText(existingScript);
  const captureCleanText = cleanText(captureText);

  if (captureLines.length === 0) {
    return {
      appendedText: "",
      mergedScript: existingText,
      captureLines: [],
    };
  }

  const tail = existingLines.slice(-10).map(normalizeLine);
  const normalizedCapture = captureLines.map(normalizeLine);
  let overlap = 0;

  const maxOverlap = Math.min(tail.length, normalizedCapture.length);
  for (let size = maxOverlap; size > 0; size--) {
    const tailSlice = tail.slice(-size);
    const captureSlice = normalizedCapture.slice(0, size);
    if (lineArraysApproximatelyEqual(tailSlice, captureSlice)) {
      overlap = size;
      break;
    }
  }

  const newLines = filterNearDuplicates(
    existingLines,
    captureLines.slice(overlap),
  );
  const mergedLines = existingLines.concat(newLines);
  const lineBasedMerged = mergedLines.join("\n");
  const lineBasedAppended = newLines.join("\n");

  const shouldUseTokenFallback =
    captureLines.length <= 2 &&
    captureCleanText.length > 80 &&
    lineBasedAppended.length >= Math.floor(captureCleanText.length * 0.75);

  if (shouldUseTokenFallback) {
    return mergeByTokenOverlap(existingText, captureCleanText, captureLines);
  }

  return {
    appendedText: lineBasedAppended,
    mergedScript: lineBasedMerged,
    captureLines,
  };
}

function mergeByTokenOverlap(
  existingText: string,
  captureText: string,
  captureLines: string[],
): SubtitleMergeResult {
  const existingNormalized = normalizeText(existingText);
  const captureNormalized = normalizeText(captureText);

  if (!captureNormalized) {
    return {
      appendedText: "",
      mergedScript: existingText,
      captureLines,
    };
  }

  if (!existingNormalized) {
    return {
      appendedText: captureText,
      mergedScript: captureText,
      captureLines,
    };
  }

  const existingTokens = tokenizeNormalized(existingNormalized);
  const captureTokens = tokenizeNormalized(captureNormalized);
  const overlap = findTokenOverlap(existingTokens, captureTokens);
  const appendedTokens = captureTokens.slice(overlap);
  const appendedText = appendedTokens.join(" ").trim();
  const mergedTokens = existingTokens.concat(appendedTokens);

  return {
    appendedText,
    mergedScript: mergedTokens.join(" ").trim(),
    captureLines,
  };
}

function findTokenOverlap(existingTokens: string[], captureTokens: string[]): number {
  const maxOverlap = Math.min(existingTokens.length, captureTokens.length, 160);
  for (let size = maxOverlap; size > 0; size--) {
    const existingSlice = existingTokens.slice(-size);
    const captureSlice = captureTokens.slice(0, size);
    if (existingSlice.join(" ") === captureSlice.join(" ")) {
      return size;
    }
  }
  return 0;
}

function lineArraysApproximatelyEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!linesApproximatelyEqual(a[i], b[i])) return false;
  }
  return true;
}

function filterNearDuplicates(existingLines: string[], candidateLines: string[]): string[] {
  const recent = existingLines.slice(-8).map(normalizeLine);
  const accepted: string[] = [];

  for (const line of candidateLines) {
    const normalized = normalizeLine(line);
    if (!normalized) continue;

    const seenRecently = recent.some((existing) => linesApproximatelyEqual(existing, normalized));
    const seenInAccepted = accepted
      .map(normalizeLine)
      .some((existing) => linesApproximatelyEqual(existing, normalized));

    if (seenRecently || seenInAccepted) continue;

    accepted.push(line);
  }

  return accepted;
}

function linesApproximatelyEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    if (shorter / longer >= 0.72) return true;
  }

  const aWords = a.split(" ").filter(Boolean);
  const bWords = b.split(" ").filter(Boolean);
  if (aWords.length === 0 || bWords.length === 0) return false;

  const aSet = new Set(aWords);
  const bSet = new Set(bWords);
  let intersection = 0;
  for (const word of aSet) {
    if (bSet.has(word)) intersection++;
  }

  const union = new Set([...aSet, ...bSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  if (jaccard >= 0.72) return true;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return maxLen > 0 && 1 - distance / maxLen >= 0.76;
}

function levenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}
