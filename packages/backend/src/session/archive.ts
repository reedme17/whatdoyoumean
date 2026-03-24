/**
 * SessionArchiveService — save, retrieve, search, delete, and export session archives.
 * In-memory store for now.
 */

import type { SessionArchive, ConversationSession } from "@wdym/shared";

export interface SessionSummary {
  id: string;
  userId: string;
  mode: ConversationSession["mode"];
  status: ConversationSession["status"];
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number;
  topicSummary: string;
  cardCount: number;
  bookmarkCount: number;
}

const archiveStore = new Map<string, SessionArchive>();

export class SessionArchiveService {
  save(archive: SessionArchive): void {
    archiveStore.set(archive.session.id, archive);
  }

  get(sessionId: string): SessionArchive | undefined {
    return archiveStore.get(sessionId);
  }

  list(userId: string): SessionSummary[] {
    return Array.from(archiveStore.values())
      .filter((a) => a.session.userId === userId)
      .sort((a, b) => b.session.startedAt.getTime() - a.session.startedAt.getTime())
      .map(toSummary);
  }

  search(userId: string, keyword: string): SessionSummary[] {
    const lower = keyword.toLowerCase();
    return Array.from(archiveStore.values())
      .filter((a) => {
        if (a.session.userId !== userId) return false;
        // Search across transcripts, cards, and topic summary
        if (a.session.topicSummary.toLowerCase().includes(lower)) return true;
        if (a.transcripts.some((t) => t.text.toLowerCase().includes(lower))) return true;
        if (a.cards.some((c) => c.content.toLowerCase().includes(lower))) return true;
        if (a.topicMap.topics.some((t) => t.name.toLowerCase().includes(lower))) return true;
        return false;
      })
      .sort((a, b) => b.session.startedAt.getTime() - a.session.startedAt.getTime())
      .map(toSummary);
  }

  delete(sessionId: string): boolean {
    return archiveStore.delete(sessionId);
  }

  export(sessionId: string): string | undefined {
    const archive = archiveStore.get(sessionId);
    if (!archive) return undefined;
    return exportAsMarkdown(archive);
  }
}

function toSummary(a: SessionArchive): SessionSummary {
  return {
    id: a.session.id,
    userId: a.session.userId,
    mode: a.session.mode,
    status: a.session.status,
    startedAt: a.session.startedAt,
    endedAt: a.session.endedAt,
    durationMs: a.session.durationMs,
    topicSummary: a.session.topicSummary,
    cardCount: a.cards.length,
    bookmarkCount: a.bookmarks.length,
  };
}

function exportAsMarkdown(archive: SessionArchive): string {
  const s = archive.session;
  const lines: string[] = [
    `# Session: ${s.topicSummary || s.id}`,
    "",
    `- **Date**: ${s.startedAt.toISOString()}`,
    `- **Duration**: ${Math.round(s.durationMs / 1000)}s`,
    `- **Mode**: ${s.mode}`,
    `- **Language**: ${s.languageCode}`,
    "",
  ];

  if (archive.cards.length > 0) {
    lines.push("## Key Points", "");
    for (const card of archive.cards) {
      lines.push(`- **[${card.category}]** ${card.content}`);
    }
    lines.push("");
  }

  if (archive.topicMap.topics.length > 0) {
    lines.push("## Topics", "");
    for (const topic of archive.topicMap.topics) {
      lines.push(`- ${topic.name} (${topic.cardIds.length} cards)`);
    }
    lines.push("");
  }

  if (archive.bookmarks.length > 0) {
    lines.push("## Bookmarks", "");
    for (const bm of archive.bookmarks) {
      lines.push(`- [${bm.timestamp}ms] ${bm.note ?? "(no note)"}`);
    }
    lines.push("");
  }

  if (archive.transcripts.length > 0) {
    lines.push("## Transcript", "");
    for (const t of archive.transcripts.filter((t) => t.isFinal)) {
      lines.push(`> **${t.speakerId}**: ${t.text}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Exported for testing */
export function clearArchives(): void {
  archiveStore.clear();
}
