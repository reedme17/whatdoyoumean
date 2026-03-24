# Implementation Plan: "What Do You Mean" (啥意思)

## Overview

Build a real-time conversation understanding tool as an Electron Mac App + Native iOS App with a shared TypeScript backend. Implementation follows a bottom-up approach: shared types → backend core → LLM/STT integrations → semantic pipeline → client apps → sync/polish.

**Auth model**: Guest mode by default — core features (live session, text mode) work without sign-in. Sign-in unlocks: session history, conversation memory, cross-device sync, terminology dictionary, user profile, and export. The app opens directly to the Home Screen.

## Tasks

- [x] 1. Project scaffolding and shared types
  - [x] 1.1 Initialize monorepo structure with backend (Node.js/TypeScript/Fastify), electron-app (Electron + React), and shared packages
    - Create `packages/shared/`, `packages/backend/`, `packages/electron-app/` directories
    - Set up TypeScript project references and shared tsconfig
    - Configure Fastify server entry point with health check endpoint (`GET /api/health`)
    - _Requirements: 19.1, 8.1_

  - [x] 1.2 Define all shared TypeScript interfaces and data models
    - Create shared type definitions: `ConversationSession`, `TranscriptSegment`, `CoreMeaningCard`, `Recommendation`, `Topic`, `TopicMap`, `TopicRelation`, `SpeakerLabel`, `User`, `UserSettings`, `UserProfile`, `MemoryEntry`, `Bookmark`, `SessionArchive`, `SyncRecord`
    - Define enums/unions: `MeaningCategory`, `RecommendationType`, `VisualizationFormat`
    - Define WebSocket event types: `ClientEvent`, `ServerEvent`
    - _Requirements: 7.2, 9.1, 10.2, 13.1_

  - [x] 1.3 Set up database schema and migrations (PostgreSQL + pgvector)
    - Create migration files for all tables: users, user_settings, user_profiles, conversation_sessions, transcript_segments, core_meaning_cards, recommendations, topics, topic_relations, speaker_labels, bookmarks, memory_entries, sync_records
    - Enable pgvector extension for memory_entries.embedding column
    - Add indexes for session lookups, keyword search, and vector similarity
    - _Requirements: 13.1, 14.1, 23.1_

  - [ ]* 1.4 Write unit tests for shared type validation helpers
    - Test data model validation (e.g., card content length limits, enum values)
    - _Requirements: 7.3_

- [x] 2. Authentication and user management
  - [x] 2.1 Implement auth endpoints and JWT token management
    - Create `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/refresh`
    - Implement JWT access/refresh token generation and validation
    - Support OAuth 2.0 flows for Apple Sign-In and Google
    - _Requirements: 21.1, 21.3_

  - [x] 2.2 Implement user settings CRUD
    - Create `GET /api/settings` and `PUT /api/settings` endpoints
    - Store and retrieve: displayLanguage, defaultAudioDevice, preferredLLMProvider, sttModePreference, memoryStoragePreference, memoryEnabled, localProcessingOnly, onboardingCompleted
    - _Requirements: 21.2, 5.5, 14.2, 17.5_

  - [ ]* 2.3 Write unit tests for auth token validation and settings persistence
    - _Requirements: 21.1, 21.2_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. LLM_Gateway with multi-provider fallback
  - [x] 4.1 Implement LLM_Gateway core with provider adapter interface
    - Create `LLMGateway` class with `complete()` and `stream()` methods
    - Implement `LLMProviderAdapter` interface with `isAvailable()`, `complete()`, `stream()`
    - Implement `LLMRequest` routing by `taskType`
    - _Requirements: 8.2, 8.5_

  - [x] 4.2 Implement Cerebras GPT-OSS-120B provider adapter (primary)
    - Create adapter for Cerebras API with streaming support
    - Configure as primary provider with 3-second timeout
    - _Requirements: 8.1, 8.7_

  - [x] 4.3 Implement fallback provider adapters (OpenAI, Anthropic, Google)
    - Create adapters for GPT, Claude, and Gemini APIs
    - Each adapter implements the same `LLMProviderAdapter` interface
    - _Requirements: 8.1, 8.5_

  - [x] 4.4 Implement automatic fallback chain and provider stats tracking
    - On primary timeout (3s) or error, cascade to next provider in priority order
    - Log per-provider response times, error rates, total requests
    - Expose `GET /api/providers/stats` endpoint
    - Support user-preferred provider selection via `setPreferredProvider()`
    - _Requirements: 8.3, 8.4, 8.6, 18.9_

  - [ ]* 4.5 Write unit tests for LLM_Gateway fallback logic
    - Test timeout cascading, provider switching, stats accumulation
    - Mock provider adapters to simulate failures and latency
    - _Requirements: 8.4, 8.6_

- [x] 5. Transcription Engine — Adaptive language-routed STT
  - [x] 5.1 Implement STTProvider interface and Groq Whisper adapter (English)
    - Create `STTProvider` interface with `startStream()`, `feedAudio()`, `stopStream()`, `onResult`
    - Implement Groq Whisper Large v3 Turbo adapter (OpenAI-compatible API)
    - Support interim and final transcript results with confidence scores
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 5.2 Implement DashScope Qwen ASR adapter (Chinese)
    - Create adapter for Alibaba DashScope Qwen ASR API
    - Support Chinese and dialect transcription with streaming results
    - _Requirements: 4.3, 4.6_

  - [x] 5.3 Implement local STT fallback (Apple Speech / Whisper.js WASM)
    - Create local STT adapter interface for on-device processing
    - Implement fallback for when cloud is unavailable or latency exceeds 500ms
    - _Requirements: 4.7, 4.8, 17.5_

  - [x] 5.4 Implement TranscriptionEngine with adaptive switching and language routing
    - Create `TranscriptionEngine` that routes audio by detected language: English → Groq Whisper, Chinese → DashScope
    - Implement adaptive cloud/local switching based on latency threshold (500ms)
    - Implement debounced switch-back to cloud (5s delay) when connectivity restores
    - Emit `onProviderSwitch` events
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 18.8_

  - [ ]* 5.5 Write unit tests for adaptive STT switching logic
    - Test language routing, fallback triggering, switch-back debounce
    - _Requirements: 4.7, 4.8_

- [x] 6. Language detection and speaker diarization
  - [x] 6.1 Implement Language_Detector with pluggable detection module
    - Create `LanguageDetector` with `detectFromAudio()` and `detectFromText()` methods
    - Detect Chinese vs English within 3 seconds of speech, handle code-switching within 2 seconds
    - Emit `onLanguageChange` events to trigger STT provider routing
    - Design as pluggable module for future language additions
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_

  - [x] 6.2 Implement Speaker_Diarizer
    - Create `SpeakerDiarizer` with `initialize()`, `processAudio()`, `assignName()`
    - Assign distinct speaker labels, detect speaker changes within 1 second
    - Mark segments with confidence < 0.7 as "uncertain attribution"
    - Support user-assigned speaker names that propagate to all segments
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.3 Write unit tests for language detection and speaker diarization
    - Test code-switching detection, speaker label consistency, uncertain attribution marking
    - _Requirements: 5.3, 6.3, 6.5_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Semantic analysis pipeline
  - [x] 8.1 Implement Semantic_Analyzer core
    - Create `SemanticAnalyzer` with `analyze()` method that sends transcript segments to LLM_Gateway
    - Extract core meaning and categorize into: factual_statement, opinion, question, decision, action_item, disagreement
    - Enforce 30-word / 50-Chinese-character limit per Core_Meaning_Card
    - Generate cards within 3-second latency budget
    - _Requirements: 7.1, 7.2, 7.3, 18.2_

  - [x] 8.2 Implement card linking and duplicate detection
    - Create `detectDuplicate()` to merge rephrased/repeated points into existing cards
    - Implement card linking for contradictions, modifications, and extensions
    - _Requirements: 7.4, 7.5_

  - [x] 8.3 Implement topic extraction and topic map maintenance
    - Create `updateTopicMap()` to group cards under topics
    - Detect topic transitions and maintain topic relationships (follows, branches_from, returns_to)
    - Maintain running topic summary per active topic
    - _Requirements: 7.6, 16.1, 16.3_

  - [ ]* 8.4 Write unit tests for semantic analysis
    - Test category classification, content length enforcement, duplicate detection, topic grouping
    - _Requirements: 7.2, 7.3, 7.5_

- [x] 9. Recommendation engine
  - [x] 9.1 Implement Recommendation_Engine
    - Create `generateRecommendations()` that produces 1-3 recommendations per card via LLM_Gateway
    - Categorize recommendations: follow_up_question, clarification, new_proposal, challenge, summary_confirmation, topic_pivot
    - Generate within 2-second latency budget
    - _Requirements: 10.1, 10.2, 18.3_

  - [x] 9.2 Implement contextual recommendation logic
    - Prioritize clarification for ambiguous statements
    - Generate challenge recommendations for unsubstantiated claims
    - Suggest summary/pivot after 5+ minutes on unresolved topic
    - Deduplicate: each new recommendation set must differ from previous set for same topic
    - Query Conversation_Memory for personalized context
    - _Requirements: 10.3, 10.4, 10.5, 10.7, 10.8_

  - [ ]* 9.3 Write unit tests for recommendation generation
    - Test recommendation type selection, deduplication, memory-informed suggestions
    - _Requirements: 10.3, 10.7_

- [x] 10. Visualization engine
  - [x] 10.1 Implement Visualization_Engine
    - Create `selectFormat()` to choose between concise_text and flow_diagram based on content type
    - Implement `renderCard()` for both formats with HTML output (web) and structured data (native)
    - Implement `renderTopicMap()` for interactive mind-map/graph rendering
    - Render within 500ms latency budget
    - _Requirements: 9.1, 9.2, 16.2, 18.4_

  - [x] 10.2 Implement card expand-to-source interaction
    - When a card is tapped/clicked, show the original transcript segments that contributed
    - _Requirements: 9.3_

- [x] 11. Terminology auto-learning
  - [x] 11.1 Implement Terminology_Learner post-processing pipeline
    - Create multi-stage post-processing: acronym folding, token merging, entity correction, case normalization
    - Implement `learnFromDiff()` to compare raw ASR output with LLM-refined text and extract candidate terms
    - Maintain per-user terminology dictionary with term, variants, frequency, source
    - Auto-correct known term variants in future transcription output before passing to Semantic_Analyzer
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 11.2 Implement terminology dictionary management API
    - Allow users to view, add, edit, and delete dictionary entries in settings
    - _Requirements: 15.5_

  - [ ]* 11.3 Write unit tests for terminology learning
    - Test acronym folding, diff extraction, dictionary matching, auto-correction
    - _Requirements: 15.1, 15.2, 15.4_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. WebSocket real-time transport layer
  - [x] 13.1 Implement WebSocket server with Socket.IO
    - Set up Socket.IO on Fastify backend
    - Implement all ClientEvent handlers: session:start, session:pause, session:resume, session:end, audio:chunk, text:submit, speaker:rename, bookmark:create
    - Implement all ServerEvent emitters: transcript:interim, transcript:final, card:created, card:updated, recommendation:new, topic:updated, stt:provider_switch, error, session:state
    - _Requirements: 4.4, 4.5, 11.1, 12.1, 12.2, 12.3_

  - [x] 13.2 Wire the real-time pipeline end-to-end
    - Connect audio:chunk → TranscriptionEngine → SemanticAnalyzer → RecommendationEngine → VisualizationEngine
    - Connect text:submit → LanguageDetector → SemanticAnalyzer (bypass audio pipeline)
    - Emit interim/final transcripts, cards, recommendations, and topic updates as they're produced
    - Handle session lifecycle (start/pause/resume/end) with proper state management
    - _Requirements: 3.2, 4.4, 11.1, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 13.3 Write integration tests for WebSocket event flow
    - Test full pipeline from audio:chunk to card:created
    - Test text:submit mode producing same output types
    - Test session pause/resume state transitions
    - _Requirements: 3.2, 12.1, 12.2, 12.3_

- [x] 14. Session management and archive
  - [x] 14.1 Implement session lifecycle on backend
    - Create/update/end sessions in database with proper state transitions
    - Track duration (excluding pauses), participant count, STT/LLM provider used
    - Auto-generate topic summary when session ends
    - Complete processing of buffered content on session end before archiving
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.1_

  - [x] 14.2 Implement Session_Archive service
    - Create `saveSession()` to persist full SessionArchive (session, transcripts, cards, recommendations, speakers, topicMap, bookmarks)
    - Implement `listSessions()` sorted by date with topic summary
    - Implement `searchSessions()` with keyword matching across transcripts, cards, and topic summaries (< 1s response)
    - Implement `deleteSession()` with permanent data removal
    - Implement `exportSession()` as Markdown format
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 14.3 Implement REST API endpoints for sessions
    - `GET /api/sessions`, `GET /api/sessions/:id`, `DELETE /api/sessions/:id`
    - `GET /api/sessions/:id/export`, `GET /api/sessions/search?q=keyword`
    - _Requirements: 13.2, 13.3, 13.6_

  - [ ]* 14.4 Write unit tests for session archive and search
    - Test session save/load round-trip, keyword search accuracy, Markdown export format
    - _Requirements: 13.1, 13.3, 13.6_

- [x] 15. Conversation Memory and personalization
  - [x] 15.1 Implement Conversation_Memory service
    - Create `extractMemory()` to extract intents, decisions, action items, unresolved questions from ended sessions
    - Create `queryMemory()` with semantic search via pgvector embeddings
    - Generate vector embeddings for memory entries
    - Support filtering by speaker, topic, and unresolved status
    - _Requirements: 14.1, 14.3, 14.4_

  - [x] 15.2 Implement memory management and User_Profile
    - Create `deleteEntry()` and `clearAllMemory()` for user control
    - Create `getUserProfile()` returning frequent topics, common speakers, tracked action items
    - Respect memoryEnabled setting — stop storing when disabled, preserve archives
    - REST endpoints: `GET /api/memory`, `GET /api/memory/profile`, `DELETE /api/memory/:entryId`, `DELETE /api/memory`
    - _Requirements: 14.5, 14.6, 14.7_

  - [ ]* 15.3 Write unit tests for memory extraction and semantic search
    - Test memory extraction from session, vector similarity search, profile aggregation
    - _Requirements: 14.1, 14.4_

- [x] 16. Bookmarks and highlights
  - [x] 16.1 Implement bookmark and highlight functionality
    - Handle `bookmark:create` WebSocket event during active sessions
    - Store timestamped bookmarks with optional notes and card references
    - Support highlighting Core_Meaning_Cards (toggle isHighlighted)
    - Persist bookmarks/highlights in SessionArchive
    - Provide filtered view to navigate bookmarked/highlighted items
    - _Requirements: 22.1, 22.2_

- [x] 17. Data synchronization across devices
  - [x] 17.1 Implement sync service
    - Create `POST /api/sync/push` and `POST /api/sync/pull` endpoints
    - Queue sessions for sync when offline, auto-sync when connectivity restores (within 60s)
    - Sync sessions, settings, memory, and terminology dictionary across devices
    - Download all synced sessions on new device login
    - Propagate settings changes within 30 seconds
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.6, 15.6_

  - [x] 17.2 Implement sync conflict resolution
    - Create `POST /api/sync/resolve` endpoint
    - Detect conflicts (same session modified on two devices)
    - Preserve both versions and prompt user to choose
    - Track sync status per session (pending, synced, conflict)
    - _Requirements: 23.5_

  - [ ]* 17.3 Write unit tests for sync queue and conflict resolution
    - Test offline queuing, conflict detection, resolution flow
    - _Requirements: 23.4, 23.5_

- [x] 18. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Electron Mac App — Audio capture and UI
  - [x] 19.1 Set up Electron app with React frontend
    - Configure Electron 33 with React 18 renderer
    - Set up IPC bridge between main process and renderer
    - Target macOS 13 (Ventura) and later
    - _Requirements: 19.1, 19.5_

  - [x] 19.2 Implement Audio_Capture_Engine for Mac (ScreenCaptureKit/CoreAudio)
    - Capture system audio via ScreenCaptureKit/CoreAudio without screen-sharing prompts
    - Simultaneously capture microphone input as separate channel
    - Implement noise suppression and auto-gain for offline mode
    - Continue capture when app window is not in focus
    - Handle audio source unavailability with notification (< 2s) and auto-reconnect (3 attempts)
    - Request Screen Recording and Microphone permissions on first launch
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 19.2, 19.3, 19.4, 19.7_

  - [x] 19.3 Implement Conversation_Flow_Panel (React)
    - Build unified real-time stream displaying transcript, Core_Meaning_Cards, and recommendations
    - Implement auto-scroll with pause-on-scroll-up behavior
    - Visually distinguish transcript text, cards, and recommendations
    - Show interim vs final transcript segments with smooth transitions (no layout shifts)
    - Display session controls: start, pause (with "Paused" indicator), resume (with pause gap marker), end
    - Show persistent microphone icon during active capture
    - Copy recommendation text to clipboard on tap/click with confirmation
    - _Requirements: 4.4, 4.5, 11.1, 11.2, 11.3, 12.2, 12.3, 10.6, 17.4_

  - [x] 19.4 Implement keyboard shortcuts and menu bar integration
    - Add keyboard shortcuts for start/stop, pause/resume, toggle stream filters
    - Create macOS menu bar quick-access menu showing session status with start/pause/resume/end controls
    - _Requirements: 19.6, 19.8_

  - [x] 19.5 Implement session archive browser and settings UI
    - Build session list view with search, date sorting, topic summaries
    - Build session detail view reusing Conversation_Flow_Panel layout
    - Build settings screen: language, audio device, LLM provider, STT mode, memory preferences
    - Build onboarding flow for first-time users
    - Build topic map visualization view (interactive mind-map/graph)
    - Build terminology dictionary management UI
    - Build memory/profile view showing frequent topics, speakers, action items
    - _Requirements: 13.2, 13.4, 16.2, 21.1, 21.2, 14.5, 15.5_

  - [ ]* 19.6 Write unit tests for React components
    - Test Conversation_Flow_Panel rendering, auto-scroll behavior, session state transitions
    - _Requirements: 11.1, 11.2, 12.1_

- [x] 20. Text input mode
  - [x] 20.1 Implement text input UI and backend processing
    - Add text input panel in the UI for paste/type text submission
    - Support Chinese, English, and mixed-language text
    - Route submitted text through Language_Detector → Semantic_Analyzer → Recommendation_Engine → Visualization_Engine (same pipeline, bypass audio)
    - Display results (cards, recommendations, topic map) within 5 seconds for up to 5000 characters
    - Store text input sessions in Session_Archive with same structure as audio sessions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 20.2 Write unit tests for text input mode
    - Test mixed-language processing, result timing, session archive storage
    - _Requirements: 3.3, 3.4, 3.5_

- [x] 21. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Privacy, security, and error handling
  - [x] 22.1 Implement privacy and audio data handling
    - Encrypt all audio transmission with TLS 1.2+
    - Delete raw audio buffers from device memory within 5 seconds of session end
    - Encrypt stored transcript and analysis data on-device
    - Implement "Local Processing Only" mode that keeps all processing on-device
    - Detect concurrent third-party audio capture and notify user
    - _Requirements: 17.1, 17.2, 17.3, 17.5, 17.6_

  - [x] 22.2 Implement error handling and resilience
    - Retry transcription errors up to 3 times before showing error indicator
    - Continue local audio capture on network loss, queue transcription for later
    - Skip failed semantic analysis segments without interrupting stream
    - Implement session crash recovery from last checkpoint with resume/end option
    - Log all errors with timestamp, subsystem, and details
    - Handle low storage: notify user, continue in reduced mode prioritizing live transcription
    - Handle low battery (< 10%): display warning suggesting pause/end
    - Handle iOS background (> 30s): auto-pause session, notify on return
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 12.5, 12.6_

  - [ ]* 22.3 Write unit tests for error handling flows
    - Test retry logic, crash recovery, graceful degradation scenarios
    - _Requirements: 25.1, 25.2, 25.4_

- [x] 23. Localization and accessibility
  - [x] 23.1 Implement localization infrastructure
    - Store all user-facing strings in localization resource files (Chinese + English)
    - Render UI labels, cards, and recommendations in user's preferred display language
    - Ensure new languages require only config changes and new resource files
    - _Requirements: 5.5, 5.8, 5.9_

  - [x] 23.2 Implement accessibility support
    - Add VoiceOver support for iOS and screen reader support for Electron/React
    - Ensure all interactive elements are accessible
    - Follow iOS Human Interface Guidelines and WCAG 2.1 AA for web
    - _Requirements: 24.1, 24.2_

- [ ] 24. Native iOS Application
  - [ ] 24.1 Set up iOS project (Swift/SwiftUI)
    - Create Xcode project targeting iOS 16+ with iPhone and iPad layouts
    - Set up networking layer connecting to shared backend (REST + WebSocket)
    - _Requirements: 20.1, 20.2_

  - [ ] 24.2 Implement iOS Audio_Capture_Engine
    - Capture microphone audio using Apple Speech Framework
    - Apply noise suppression and auto-gain
    - Handle background audio capture (up to 30s, then auto-pause)
    - Retain microphone permission across sessions
    - Continue capture in Do Not Disturb mode
    - Display ambient noise warning when speech recognition accuracy drops below 80%
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 20.3, 20.4, 20.5, 20.7_

  - [ ] 24.3 Implement iOS Conversation_Flow_Panel and session UI
    - Build real-time stream view with transcript, cards, recommendations
    - Implement session controls (start/pause/resume/end)
    - Build session archive browser with search
    - Build settings, onboarding, and profile views
    - Integrate iOS share sheet for session export
    - Build topic map visualization
    - _Requirements: 11.1, 11.2, 11.3, 12.1, 13.2, 13.4, 20.6, 21.1_

  - [ ]* 24.4 Write unit tests for iOS components
    - Test audio capture lifecycle, session state management, UI rendering
    - _Requirements: 20.3, 20.5_

- [x] 25. Performance optimization and monitoring
  - [x] 25.1 Implement performance monitoring and enforce latency budgets
    - Monitor and enforce: STT interim < 1s, semantic analysis < 3s, recommendations < 2s, visualization < 500ms
    - Maintain 30fps on Conversation_Flow_Panel
    - Enforce resource limits: iOS ≤ 300MB RAM, ≤ 15% CPU; web ≤ 20% single CPU core
    - Log local vs cloud STT response times per session for benchmarking
    - Use LLM provider stats to optimize default provider selection and fallback ordering
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9_

- [x] 26. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Backend is TypeScript (Node.js + Fastify), Mac app is Electron + React (TypeScript), iOS app is Swift/SwiftUI
- The iOS app (task 24) can be developed in parallel with the Electron app (task 19) since both share the same backend
