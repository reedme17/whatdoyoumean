-- 001_initial_schema.sql
-- Initial database schema for "What Do You Mean" (啥意思)
-- Requires PostgreSQL 16+ with pgvector extension

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- Users
-- ============================================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  auth_provider TEXT NOT NULL CHECK (auth_provider IN ('apple', 'google', 'email')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- User Settings (1:1 with users)
-- ============================================================================

CREATE TABLE user_settings (
  user_id                   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_language          TEXT NOT NULL DEFAULT 'en' CHECK (display_language IN ('zh', 'en')),
  default_audio_device      TEXT,
  preferred_llm_provider    TEXT NOT NULL DEFAULT 'openai',
  stt_mode_preference       TEXT NOT NULL DEFAULT 'auto' CHECK (stt_mode_preference IN ('auto', 'local_only', 'cloud_only')),
  memory_storage_preference TEXT NOT NULL DEFAULT 'cloud' CHECK (memory_storage_preference IN ('local', 'cloud')),
  memory_enabled            BOOLEAN NOT NULL DEFAULT true,
  local_processing_only     BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed      BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================================
-- User Profiles (1:1 with users)
-- JSON columns for flexible nested structures that match the TS interfaces
-- ============================================================================

CREATE TABLE user_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  frequent_topics    JSONB NOT NULL DEFAULT '[]',
  common_speakers    JSONB NOT NULL DEFAULT '[]',
  tracked_action_items JSONB NOT NULL DEFAULT '[]',
  total_sessions     INTEGER NOT NULL DEFAULT 0,
  total_duration_ms  BIGINT NOT NULL DEFAULT 0
);


-- ============================================================================
-- Conversation Sessions
-- ============================================================================

CREATE TABLE conversation_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode              TEXT NOT NULL CHECK (mode IN ('online', 'offline', 'text')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  paused_at         TIMESTAMPTZ,
  duration_ms       BIGINT NOT NULL DEFAULT 0,
  language_code     TEXT NOT NULL DEFAULT 'en' CHECK (language_code IN ('zh', 'en', 'mixed')),
  participant_count INTEGER NOT NULL DEFAULT 1,
  stt_provider      TEXT NOT NULL DEFAULT '',
  llm_provider      TEXT NOT NULL DEFAULT '',
  topic_summary     TEXT NOT NULL DEFAULT '',
  metadata          JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================================
-- Transcript Segments
-- ============================================================================

CREATE TABLE transcript_segments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  language_code TEXT NOT NULL CHECK (language_code IN ('zh', 'en')),
  speaker_id    TEXT NOT NULL,
  start_time    DOUBLE PRECISION NOT NULL,
  end_time      DOUBLE PRECISION NOT NULL,
  is_final      BOOLEAN NOT NULL DEFAULT false,
  confidence    DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  provider      TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Topics
-- ============================================================================

CREATE TABLE topics (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  card_ids         JSONB NOT NULL DEFAULT '[]',
  start_time       DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_active_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_resolved      BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================================
-- Core Meaning Cards
-- ============================================================================

CREATE TABLE core_meaning_cards (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id           UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  category             TEXT NOT NULL CHECK (category IN (
                         'factual_statement', 'opinion', 'question',
                         'decision', 'action_item', 'disagreement'
                       )),
  content              TEXT NOT NULL,
  source_segment_ids   JSONB NOT NULL DEFAULT '[]',
  linked_card_ids      JSONB NOT NULL DEFAULT '[]',
  link_type            TEXT CHECK (link_type IN ('contradicts', 'modifies', 'extends') OR link_type IS NULL),
  topic_id             UUID REFERENCES topics(id) ON DELETE SET NULL,
  visualization_format TEXT NOT NULL DEFAULT 'concise_text' CHECK (visualization_format IN ('concise_text', 'flow_diagram')),
  is_highlighted       BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- Recommendations
-- ============================================================================

CREATE TABLE recommendations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id           UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  source_card_id       UUID NOT NULL REFERENCES core_meaning_cards(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN (
                         'follow_up_question', 'clarification', 'new_proposal',
                         'challenge', 'summary_confirmation', 'topic_pivot'
                       )),
  text                 TEXT NOT NULL,
  reasoning            TEXT NOT NULL DEFAULT '',
  memory_reference_ids JSONB NOT NULL DEFAULT '[]',
  set_index            INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Topic Relations
-- ============================================================================

CREATE TABLE topic_relations (
  from_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  to_topic_id   UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('follows', 'branches_from', 'returns_to')),
  PRIMARY KEY (from_topic_id, to_topic_id)
);

-- ============================================================================
-- Speaker Labels
-- ============================================================================

CREATE TABLE speaker_labels (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  display_name TEXT,
  is_uncertain BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================================
-- Bookmarks
-- ============================================================================

CREATE TABLE bookmarks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp  DOUBLE PRECISION NOT NULL,
  note       TEXT,
  card_id    UUID REFERENCES core_meaning_cards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Memory Entries (with pgvector embedding)
-- ============================================================================

CREATE TABLE memory_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('intent', 'decision', 'action_item', 'unresolved_question')),
  content     TEXT NOT NULL,
  speaker_ids JSONB NOT NULL DEFAULT '[]',
  topics      JSONB NOT NULL DEFAULT '[]',
  embedding   vector(1536),
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- Sync Records
-- ============================================================================

CREATE TABLE sync_records (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id     UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  sync_status    TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  local_version  INTEGER NOT NULL DEFAULT 0,
  remote_version INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  queued_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Session lookups by user (list sessions, sorted by date)
CREATE INDEX idx_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX idx_sessions_user_started ON conversation_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_status ON conversation_sessions(status);

-- Transcript lookups by session
CREATE INDEX idx_transcripts_session_id ON transcript_segments(session_id);
CREATE INDEX idx_transcripts_session_time ON transcript_segments(session_id, start_time);

-- Keyword search on transcript text and topic summaries
CREATE INDEX idx_transcripts_text_search ON transcript_segments USING gin(to_tsvector('simple', text));
CREATE INDEX idx_sessions_topic_search ON conversation_sessions USING gin(to_tsvector('simple', topic_summary));

-- Card lookups by session
CREATE INDEX idx_cards_session_id ON core_meaning_cards(session_id);
CREATE INDEX idx_cards_topic_id ON core_meaning_cards(topic_id);

-- Recommendation lookups by session and card
CREATE INDEX idx_recommendations_session_id ON recommendations(session_id);
CREATE INDEX idx_recommendations_source_card ON recommendations(source_card_id);

-- Topic lookups by session
CREATE INDEX idx_topics_session_id ON topics(session_id);

-- Topic relations
CREATE INDEX idx_topic_relations_from ON topic_relations(from_topic_id);
CREATE INDEX idx_topic_relations_to ON topic_relations(to_topic_id);

-- Speaker labels by session
CREATE INDEX idx_speaker_labels_session_id ON speaker_labels(session_id);

-- Bookmark lookups by session and user
CREATE INDEX idx_bookmarks_session_id ON bookmarks(session_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

-- Memory entry lookups and vector similarity search
CREATE INDEX idx_memory_user_id ON memory_entries(user_id);
CREATE INDEX idx_memory_session_id ON memory_entries(session_id);
CREATE INDEX idx_memory_type ON memory_entries(user_id, type);
CREATE INDEX idx_memory_unresolved ON memory_entries(user_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_memory_embedding ON memory_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Sync record lookups
CREATE INDEX idx_sync_user_id ON sync_records(user_id);
CREATE INDEX idx_sync_session_id ON sync_records(session_id);
CREATE INDEX idx_sync_status ON sync_records(user_id, sync_status);
