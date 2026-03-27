# What Do You Mean (啥意思) — Development Progress

## Phase 1: Spec & Planning

Created the complete spec document suite defining product direction and technical architecture.

- `requirements.md`: User stories, acceptance criteria, correctness properties
- `design.md`: System architecture, data models, API design, WebSocket protocol
- `tasks.md`: 35 implementation tasks (Phase 1: 1-26, Phase 2: 27-35)
- `ux.md`: Interaction flows, screen definitions, lo-fi black & white style guide

Product: Real-time conversation understanding tool. Captures live audio → transcribes → LLM extracts core meaning → visual cards + recommendation tokens.
Platforms: Electron Mac App + future Native iOS.

---

## Phase 2: Backend Implementation

Built the complete backend service. 283 tests passing.

### LLM Gateway (`packages/backend/src/llm/`)
- `gateway.ts`: Unified LLM call interface with provider registration and fallback
- `providers/cerebras.ts`: Cerebras integration, model `llama3.1-8b` (free tier, will switch to `gpt-oss-120b` later)
- `providers/openai.ts`: OpenAI GPT integration
- `providers/anthropic.ts`: Claude integration
- `providers/google.ts`: Gemini integration
- `providers/openai-compatible.ts`: Generic OpenAI-compatible interface
- `types.ts`: LLM request/response type definitions

### STT Engine (`packages/backend/src/stt/`)
- `engine.ts`: Adaptive transcription engine with provider switching
- `providers/groq-whisper.ts`: Groq Whisper API — accepts base64 WAV, returns transcribed text + latency
- `providers/dashscope.ts`: Alibaba DashScope (Chinese STT, reserved for future)
- `providers/local-stub.ts`: Local stub for development
- `types.ts`: Transcription-related types

### Semantic Analysis (`packages/backend/src/semantic/`)
- `analyzer.ts`: Core semantic analyzer
  - `analyze()`: Receives transcript segment → calls LLM → returns CoreMeaningCard (category: fact/opinion/question/decision/action/disagreement)
  - `detectDuplicate()`: Duplicate detection + merge (currently disabled — causes recap card mutation)
  - `updateTopicMap()`: Maintains topic graph

### Recommendation Engine (`packages/backend/src/recommendation/`)
- `engine.ts`: Generates contextual suggestions based on current card + topic map
- Outputs `Recommendation[]`, each with text + reasoning + category

### Visualization Engine (`packages/backend/src/visualization/`)
- `engine.ts`: Selects display format per card type (concise_text, comparison, timeline, etc.)

### Language Detection (`packages/backend/src/language/`)
- `detector.ts`: Detects language from text (Chinese/English/mixed) using Unicode ranges + heuristics

### Terminology Learning (`packages/backend/src/terminology/`)
- `learner.ts`: Learns domain-specific terms over time through usage

### Session Management (`packages/backend/src/session/`)
- `manager.ts`: Session lifecycle (create/pause/resume/end)
- `archive.ts`: Session archival
- `routes.ts`: REST API routes

### Other Services
- `bookmark/service.ts`: Bookmark (Flag ⚑) service
- `memory/`: Memory service + REST routes
- `sync/`: Cross-device sync service + routes
- `privacy/handler.ts`: Privacy handling
- `error/handler.ts`: Global error handling
- `performance/monitor.ts`: Performance monitoring
- `speaker/diarizer.ts`: Speaker diarization (reserved for future)
- `settings/routes.ts`: Settings REST routes
- `auth/`: JWT + auth middleware

### WebSocket Handler (`packages/backend/src/ws/handler.ts`)
- Socket.IO server on port 3001 (REST on port 3000)
- Event pipeline: `audio:chunk` → Groq Whisper transcription → language detection → semantic analysis → card creation → recommendation generation
- Supports `text:submit` text mode (bypasses audio, goes straight to semantic analysis)
- 5-second silence-based segmentation: accumulates transcript text, finalizes into card after 5s of no new content
- session:end awaits flush of remaining pending text before emitting session:ended

---

## Phase 3: Electron Mac App

Built the complete Electron frontend with all screens and interactions.

### Main Process (`packages/electron-app/src/main/`)
- `index.ts`: BrowserWindow creation, IPC handler registration, macOS microphone permission request via `systemPreferences.askForMediaAccess("microphone")`
- `preload.ts`: contextBridge exposes electronAPI (startSession, stopSession, getDesktopSources, etc.)
- `audio-capture.ts` / `audio-capture-stub.ts`: Main process audio capture (stub implementation)

### Renderer Process (`packages/electron-app/src/renderer/`)
- `App.tsx`: Root component, state machine driving screen transitions (home → live/text → recap)
- `hooks/useSocket.ts`: Socket.IO connection management with auto-reconnect
- `hooks/useAudioCapture.ts`: Web Audio API microphone capture
  - 4-second chunk accumulation → 16kHz mono WAV downsampling → base64 encoding → WebSocket send
  - AnalyserNode exposed for waveform visualization
  - Optional system audio mixing via desktopCapturer (disabled by default)

### Screen Components
- `HomeScreen.tsx`: START button + audio source toggle (Mic Only / Mic+System) + Text Mode + menu
- `LiveSession.tsx`: Real-time card stream + auto-scroll + empty state (listening/mic error)
- `RecapScreen.tsx`: Post-session review, editable cards, Export, Flag timeline
- `TextModeScreen.tsx`: Text input → analysis → reuses RecapScreen for result display
- `ExpandPanel.tsx`: Right slide-out panel (Sign In, Profile, History, Settings, Terminology, About)
- `HistoryView.tsx`: Session history list + search
- `LoginScreen.tsx`: Login page (Apple/Google/Email mock)
- `BottomBar.tsx`: Bottom control bar (waveform + Flag ⚑ + Stop ■)
- `CoreMeaningCard.tsx`: Card component (category badge, speaker label, content, edit mode, link indicator)
- `RecommendationTokens.tsx`: Recommendation badge list, click to copy
- `Waveform.tsx`: Canvas-based real-time frequency bar visualization (20 bars, requestAnimationFrame)

### Keyboard Shortcuts
- ⌘⇧S: Start/Stop session
- ⌘B: Flag current moment
- ⌘T: Enter Text Mode
- ⌘E: Export (copy markdown to clipboard)
- ⌘/: Toggle Expand Panel

---

## Phase 4: WebSocket + LLM Integration Debugging

Fixed 5 stacked bugs. Documented in `docs/bug-report-websocket-llm-integration.md`.

1. **Electron blank page**: No bundler — renderer JSX/TS couldn't run in browser → added esbuild
2. **Fastify/Socket.IO conflict**: Both sharing same HTTP server caused route conflicts → separated to port 3000 (REST) and 3001 (WS)
3. **Zombie processes on ports**: Previous processes didn't exit cleanly → `lsof -ti :3000 | xargs kill`
4. **Wrong Cerebras model name**: Used non-existent model → changed to `llama3.1-8b`
5. **GPT-OSS-120B unavailable**: Free tier temporary rate limit → using llama3.1-8b for now

---

## Phase 5: Real Audio Capture

Implemented real microphone capture, replacing the previous stub.

- `useAudioCapture.ts`: `navigator.mediaDevices.getUserMedia()` to get microphone stream
- AudioContext + ScriptProcessorNode for audio data processing
- Every 4 seconds: accumulate chunk → `downsample()` to 16kHz → `encodeWavBase64()` → send via WebSocket
- Backend `groq-whisper.ts` receives base64 WAV → calls Groq Whisper API → returns transcribed text
- Fixed Node 18 `File` polyfill issue (`globalThis.File = require('node:buffer').File`)
- Auto language detection: no language parameter passed, Whisper auto-detects Chinese/English

---

## Phase 6: Guest Mode

Implemented core functionality without requiring login.

- App launches directly to HomeScreen (no longer shows LoginScreen)
- Live Session, Text Mode, Recap all work without login
- Sign In entry point moved to Expand Panel
- Login unlocks: History, Memory, Sync, Terminology, Profile
- Guest mode shows 🔒 on History and Terminology

---

## Phase 7: System Audio Capture

Implemented desktopCapturer system audio capture (disabled by default due to compatibility issues).

- Main process `desktop:getSources` IPC handler → `desktopCapturer.getSources()`
- Renderer gets screen source → `getUserMedia({ chromeMediaSource: "desktop" })`
- AudioContext ChannelMerger mixes mic + system audio → mono output
- **Issue**: Electron 33 + macOS — desktopCapturer audio incompatible with AudioContext, causes `AudioContext encountered an error`, recording stops after 0.1s
- **Resolution**: System audio disabled by default. Added toggle on HomeScreen:
  - "🎤 Mic Only" (default, stable)
  - "🎤🔊 Mic + System" (marked "⚠ experimental")

---

## Phase 8: shadcn/ui + Tailwind CSS v4 Migration

Migrated from inline styles to proper shadcn/ui components with Tailwind CSS v4.

### Installation
- `tailwindcss` v4.2.2, `@tailwindcss/cli` v4.2.2
- `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`

### Infrastructure
- `globals.css`: Tailwind v4 `@theme` defining design tokens (colors, radii) + `@layer base` reset
- `lib/utils.ts`: `cn()` helper (clsx + tailwind-merge)
- `build-renderer.mjs`: Tailwind CLI → esbuild two-step build

### shadcn/ui Components (`components/ui/`)
- `button.tsx`: cva variants (default/outline/ghost/destructive × default/sm/lg/icon)
- `card.tsx`: Card + CardHeader + CardContent
- `badge.tsx`: cva variants (default/secondary/outline)
- `input.tsx`: Standard input field
- `textarea.tsx`: Standard text area

### Migration
- All 10 screen components migrated from `styles.ts` inline styles to Tailwind classes + shadcn components
- Deleted `styles.ts`
- Cleaned up inline `<style>` block from `index.html`

### Bug Fixes
- **CSS layer priority**: `* {}` reset outside layers had higher priority than `@layer utilities` Tailwind classes → moved reset into `@layer base`
- **Tailwind CLI path**: `npx @tailwindcss/cli` prompted for installation on Node 18 → changed to use local `node_modules/@tailwindcss/cli/dist/index.mjs`
- **Node version**: mise.toml configured node 22, but user terminal still using nvm's node 18 → need `eval "$(mise activate bash)"`

---

## Phase 9: Silence-Based Card Generation

Changed card generation logic from "one card per 4s chunk" to "finalize card after speaker pauses".

### Previous Logic
- Frontend sends audio chunk every 4 seconds
- Backend immediately calls LLM to generate a card for each transcription result
- Result: saying "thank you" generates its own card — too granular

### Current Logic
- Frontend still sends chunks every 4s (maintains transcription real-time responsiveness)
- Backend accumulates transcription text in `pendingText`
- 5 seconds with no new transcription → `finalizePendingText()` creates one card from all accumulated text
- session:end `await`s `finalizePendingText()` to flush remaining text (ensures card arrives before session:ended event)

### Related Fixes
- **Duplicate cards in recap**: `handleStop` had redundant logic pushing `currentCard` into `cards` array, but `card:created` event handler already did this → removed duplicate push
- **Cards mutating in recap**: `detectDuplicate()` asynchronously modified existing card content → disabled duplicate detection entirely

### Changed Files
- `packages/backend/src/ws/handler.ts`: Added `pendingText`, `pendingSegments`, `silenceTimer` state; added `finalizePendingText()` function; `SILENCE_THRESHOLD_MS = 5000`
- `packages/electron-app/src/renderer/App.tsx`: Removed redundant `currentCard` push in `handleStop`

---

## Phase 10: Real-Time Waveform Visualization

Added real-time audio waveform display in the Live Session bottom bar.

- `useAudioCapture.ts`: Added `AnalyserNode` (fftSize=256, smoothingTimeConstant=0.8), connected to mixedSource, exposed via `analyserRef`
- `Waveform.tsx`: Canvas component
  - `requestAnimationFrame` loop reads `getByteFrequencyData()`
  - 20 vertical bars, height mapped to frequency values, vertically centered
  - Bars animate when speaking, show flat line when silent
  - Color `#18181b` (foreground), 80% opacity
- `BottomBar.tsx`: Left side replaced "● Listening..." text with `<Waveform />` component
- Data flow: AudioContext → AnalyserNode → canvas (pure frontend, no backend involvement)

---

## Phase 11: Design System Tokens

Created cross-platform design token definitions.

- `packages/shared/src/tokens.ts`: Single source of truth
  - `colors`: Semantic colors (background, foreground, primary, muted, destructive, etc.)
  - `fontFamily`: sans + mono
  - `fontSize`: xs(12) through 6xl(60)
  - `fontWeight`: light(300) through bold(700)
  - `lineHeight`: tight(1.25) / normal(1.5) / relaxed(1.625)
  - `spacing`: 4px base scale (0 through 64)
  - `radius`: sm(4) / md(6) / lg(8) / full(9999)
  - `duration`: fast(150) / normal(200) / slow(300)
  - `shadow`: sm / md
- Currently `globals.css` `@theme` values are manually synced with `tokens.ts`
- Future iOS app can generate SwiftUI Color/Font extensions from the same token source

---

## Phase 12: Session End Processing Flow

Improved the Stop → Recap transition to ensure the final card is always included.

### Previous Issue
- Pressing Stop sent `session:end` and immediately switched to recap screen
- Backend's `finalizePendingText` is async — the final card arrived after screen transition
- `card:created` events were ignored on recap screen, so the last card was lost

### Current Flow
1. User presses Stop → screen transitions to "Processing..." (spinner)
2. Backend receives `session:end` → `await finalizePendingText()` → emits `card:created` for final card → emits `session:state: ended`
3. Frontend accepts `card:created` during "processing" screen
4. Frontend receives `session:state: ended` → transitions to recap (all cards present)
5. 15-second timeout fallback: if `session:ended` never arrives, force transition to recap

### Changed Files
- `packages/electron-app/src/renderer/App.tsx`: Added "processing" screen state, `session:state` event handler, 15s timeout fallback
- `packages/shared/src/events.ts`: Added `pending:preview` event type

---

## Phase 13: Live Transcript Preview

Added real-time text preview during recording so users can see what's being transcribed before cards are finalized.

- Backend emits `pending:preview` event with accumulated `pendingText` each time new transcription arrives
- Frontend shows preview as a dashed-border italic text block below finalized cards in LiveSession
- Preview clears when a card is finalized (5s silence) or session ends
- Added `pending:preview` to `useSocket.ts` event listener list (was missing, causing preview not to appear)

### Changed Files
- `packages/shared/src/events.ts`: Added `pending:preview` event type to `ServerEvent` union
- `packages/backend/src/ws/handler.ts`: Emits `pending:preview` after accumulating text
- `packages/electron-app/src/renderer/App.tsx`: Added `pendingPreview` state, handles `pending:preview` event
- `packages/electron-app/src/renderer/components/LiveSession.tsx`: Renders pending preview block
- `packages/electron-app/src/renderer/hooks/useSocket.ts`: Added `pending:preview` to event listener array

---

## Phase 14: Whisper Silence Hallucination Fix

Fixed Whisper producing phantom transcriptions ("Thank you", "You") every 4 seconds during silence.

### Root Cause
- Frontend sent audio chunks every 4 seconds regardless of volume
- Whisper hallucinates short phrases when given pure silence as input

### Fix
- Added RMS energy calculation in `useAudioCapture.ts` before sending chunks
- Chunks with RMS below 0.005 threshold are silently dropped (not sent to backend)
- Console logs `Silent chunk (RMS=0.00xxx) — skipping` for debugging

### Changed Files
- `packages/electron-app/src/renderer/hooks/useAudioCapture.ts`: Added `calculateRMS()` function and `SILENCE_RMS_THRESHOLD` constant

---

## Phase 15: Duplicate Card Rendering Fix

Fixed cards appearing twice in LiveSession — one with gray border, one with black border.

### Root Cause
- `card:created` handler both pushed to `cards[]` array AND set `currentCard`
- LiveSession rendered both `cards.map()` and `{currentCard && ...}` separately
- Same card appeared twice: once in cards list (gray border, opacity-95) and once as currentCard (black border)

### Fix
- Removed `setCurrentCard(newCard)` from `card:created` handler
- `currentCard` concept replaced by `pendingPreview` for live text display

### Changed Files
- `packages/electron-app/src/renderer/App.tsx`: Removed `setCurrentCard` from card:created handler

---

## Phase 16: Language Matching for Cards and Recommendations

Enforced language consistency between transcript input, card content, and recommendation text.

### Issue
- Chinese speech would sometimes produce English card content or English recommendations
- Recommendations were always in English regardless of card language

### Fix
- Added language matching instruction to semantic analyzer system prompt: "content MUST be in the SAME LANGUAGE as the transcript segment"
- Added language matching instruction to recommendation engine system prompt: "recommendation text MUST be in the SAME LANGUAGE as the card content"

### Changed Files
- `packages/backend/src/semantic/analyzer.ts`: Updated `SYSTEM_PROMPT`
- `packages/backend/src/recommendation/engine.ts`: Updated `SYSTEM_PROMPT`

---

## Phase 17: Additional shadcn/ui Components

Added three more shadcn/ui components and migrated remaining hand-written UI elements.

### New Components
- `components/ui/sheet.tsx`: Slide-out panel (Sheet + SheetHeader + SheetContent + SheetClose) — replaces hand-written backdrop + fixed panel in ExpandPanel
- `components/ui/toggle.tsx`: Toggle button with pressed state via cva — replaces hand-written audio source switch in HomeScreen
- `components/ui/separator.tsx`: Horizontal/vertical separator — replaces `border-b border-border` dividers in RecapScreen, TextModeScreen, ExpandPanel

### Migrated Components
- `ExpandPanel.tsx`: Now uses Sheet, SheetHeader, SheetContent, SheetClose, Separator
- `HomeScreen.tsx`: Audio source toggle now uses Toggle component
- `RecapScreen.tsx`: Top bar and flagged moments dividers use Separator
- `TextModeScreen.tsx`: Top bar divider uses Separator

---

## Phase 18: UI Polish

- Removed recommendation tokens from RecapScreen (only shown during live session)
- Fixed titlebar overlap: added `padding-top: 38px` to `#root` in `globals.css` to clear macOS traffic light buttons

---

## Phase 19: Editorial Theme

Applied an editorial/magazine aesthetic to the entire UI.

### Color Palette
- Warm paper tones: background `#FAF8F5`, foreground `#1A1A1A`, muted `#8C8578`
- Editorial red accent `#C4553A` — used sparingly for recording indicator, flag, action/disagreement badges
- Card background `#FFFFFF` for subtle lift against cream background
- All radii set to 0/2px (no rounded corners — flat editorial look)

### Typography Evolution
- Started with Playfair Display + Source Sans 3 (editorial direction doc)
- Switched to Merriweather + Mulish (Journal pairing from fonttrio.xyz)
- Switched to Plus Jakarta Sans + PT Serif (Curator pairing)
- Final: **Lora** (heading/cards) + **Nunito Sans** (body/UI) + **Inconsolata** (mono) — Storyteller pairing from fonttrio.xyz
- Fonts loaded via Google Fonts CDN with CSP allowing `fonts.googleapis.com` and `fonts.gstatic.com`

### Font Loading Issues
- Local @fontsource approach failed — Tailwind CLI inlined @font-face but woff2 file paths didn't resolve in Electron's file:// protocol
- Google Fonts CDN approach required CSP update: added `font-src https://fonts.gstatic.com` and `style-src https://fonts.googleapis.com`
- Tailwind v4 `font-[var(--font-display)]` was parsed as `font-weight` not `font-family` — switched to `font-serif` / `font-sans` Tailwind utilities mapped via `--font-serif` / `--font-sans` theme variables

### Component Styling
- Cards: no borders, separated by thin rules (`border-b border-border`), content in serif, category as uppercase letter-spaced label
- Buttons: uppercase, letter-spaced, outline style
- BottomBar: plain text buttons instead of shadcn Button components
- ExpandPanel: uppercase letter-spaced menu items, text-only navigation
- Processing screen: serif italic "Processing..." with expanding line animation
- Pending preview: serif italic with gentle pulse opacity animation

### Changed Files
- `globals.css`: Editorial color palette, font variables, animations (fadeInUp, gentlePulse, expandLine)
- `index.html`: Google Fonts link, updated CSP
- All component files: Editorial styling with `font-serif` / `font-sans` classes
- `build-renderer.mjs`: Font file copy step (for local font approach, kept for future use)
- `Waveform.tsx`: Updated colors to match editorial palette

---

## Phase 20: Language Matching Enhancement

Strengthened language matching for cards and recommendations.

- Added explicit language detection (Chinese character regex) in both `buildAnalysisPrompt` and `buildRecommendationPrompt`
- User prompt now includes `⚠ LANGUAGE: The card/transcript is in Chinese. ALL text MUST be in Chinese (中文).` when Chinese is detected
- Previously relied only on system prompt instruction which LLM sometimes ignored

### Changed Files
- `packages/backend/src/recommendation/engine.ts`: Added `hasChinese` detection + explicit language hint in user prompt
- `packages/backend/src/semantic/analyzer.ts`: Same language hint added to analysis prompt

---

## Phase 21: Steering & Skills Setup

- Created `.kiro/steering/documentation.md` (auto-included) — rules for updating progress.md and bug reports
- Created `~/.kiro/skills/frontend-design.md` (global skill) — frontend design quality guidelines
- Created `docs/design-direction-editorial.md` — editorial design direction reference document

---

## Architecture Summary

```
packages/
├── shared/          # Shared types + design tokens
│   └── src/
│       ├── index.ts       # CoreMeaningCard, Recommendation, ServerEvent types
│       └── tokens.ts      # Design system tokens
├── backend/         # Node.js backend
│   └── src/
│       ├── index.ts       # Fastify REST (port 3000) + Socket.IO WS (port 3001)
│       ├── ws/handler.ts  # WebSocket event handling + audio pipeline
│       ├── llm/           # LLM Gateway + providers
│       ├── stt/           # STT Engine + Groq Whisper
│       ├── semantic/      # Semantic analyzer
│       ├── recommendation/# Recommendation engine
│       └── ...            # session, memory, bookmark, sync, etc.
└── electron-app/    # Electron Mac App
    └── src/
        ├── main/          # Electron main process
        └── renderer/      # React renderer process
            ├── App.tsx
            ├── globals.css      # Tailwind v4 theme
            ├── lib/utils.ts     # cn() helper
            ├── hooks/           # useSocket, useAudioCapture
            └── components/      # Screens + shadcn/ui components
```

## Key Configuration
- `.env`: `CEREBRAS_API_KEY`, `GROQ_API_KEY` (gitignored)
- `mise.toml`: Node 22
- Backend REST: `http://localhost:3000`
- Backend WS: `ws://localhost:3001`
- Cerebras model: `llama3.1-8b` (to change model, edit `providers/cerebras.ts`)

---

## Phase 22: STT Language Selection

Added user-configurable language preference for Whisper STT to improve transcription accuracy.

### How It Works
- User selects language in Settings panel: Auto-detect (default), 中文 (Chinese), or English
- "Auto" omits the `language` parameter, letting Whisper auto-detect per chunk
- Setting "zh" or "en" passes the `language` parameter to Groq Whisper API, biasing recognition toward that language
- Whisper still recognizes other languages within the audio — the parameter acts as a hint, not a hard filter

### Frontend Changes
- `App.tsx`: Added `sttLanguage` state ("auto" | "zh" | "en"), passed through `session:start` config and to ExpandPanel/HomeScreen
- `ExpandPanel.tsx`: Settings section now shows radio-style language selector (Auto / 中文 / English)
- `HomeScreen.tsx`: Shows subtle language indicator below audio source toggle when not "auto"

### Backend Changes
- `ws/handler.ts`: Reads `language` from session:start config, stores in `SocketSessionState.sttLanguage`, passes to `groqWhisper.transcribeBase64Wav()` — "auto" passes `undefined` (omit param), "zh"/"en" passes the value directly
- `groq-whisper.ts`: `transcribeBase64Wav` already supported optional `language` parameter — no changes needed

### Changed Files
- `packages/electron-app/src/renderer/App.tsx`
- `packages/electron-app/src/renderer/components/ExpandPanel.tsx`
- `packages/electron-app/src/renderer/components/HomeScreen.tsx`
- `packages/backend/src/ws/handler.ts`

---

## Phase 23: HomeScreen Redesign + Button Morph Animation

Redesigned HomeScreen from Figma and implemented button-to-bottom-bar morph animation.

### HomeScreen Redesign (from Figma)
- Three-section vertical layout: titlebar spacer / content / menu area
- Tagline: "Ready to interpret for you." — Lora 20px, color `#60594D`
- "Start listening" pill button — Nunito Sans Bold 14px, bg `#F0EDE8`, text `#5B5449`, border-radius 18px
- Keyboard icon (text mode) next to button, gap 12px
- Menu icon bottom-right, padding 10px inside container + 9px outer
- Layout matches Figma Auto Layout: `justify-between p-[9px]`, content group `gap-[20px] items-center`

### Button Morph Animation
- Click "Start listening" → button morphs into BottomBar before screen transition
- Uses `position: fixed` + `getBoundingClientRect()` for pixel-perfect animation
- Animates: width (pill → full), height (36 → 148), position (center → bottom), borderRadius (18 → 16/16/10/10)
- Text fades out during morph, BottomBar content fades in after
- Easing: `cubic-bezier(.7, .01, .23, 1.13)` — slow start, fast middle, slight overshoot
- Duration: 700ms
- `layoutId` approach abandoned — doesn't work across screen mount/unmount (causes border-radius drop to 0 and position teleporting)

### BottomBar Redesign (from Figma)
- Height 148px with `-mb-[100px]` (100px extends below window for sink effect)
- Content in top 48px: "Listening..." + waveform | MapPinPlus flag icon | Square + "End"
- Colors: bg `#F0EDE8`, text `#93918E`, border-radius `16px 16px 10px 10px`
- MapPinPlusIcon: hand-written SVG + motion animation (plus sign pulses on hover)
- Square icon from lucide-react (10px, filled) for End button
- Waveform (60×16) added next to "Listening..." text

### Global Button Updates
- Normal variant: border-radius 18px, text color `#5B5449`
- All buttons: `motion.button` with `whileTap: { scale: 0.96 }` pressed state
- Press-then-act: onClick fires only after scale-back animation completes (150ms)
- `whitespace-nowrap` on button text to prevent wrapping during scale animation

### Other Changes
- Window default size: 640×480
- STT language selection: zh+en (default), en, zh, auto — in Settings panel
- HomeScreen tagline: "Ready to interpret for you."

### Changed Files
- `packages/electron-app/src/renderer/components/HomeScreen.tsx`
- `packages/electron-app/src/renderer/components/BottomBar.tsx`
- `packages/electron-app/src/renderer/components/ui/button.tsx`
- `packages/electron-app/src/renderer/components/ui/map-pin-plus-icon.tsx` (new)
- `packages/electron-app/src/renderer/App.tsx`
- `packages/electron-app/src/renderer/components/ExpandPanel.tsx`
- `packages/electron-app/src/main/index.ts`
- `packages/backend/src/ws/handler.ts`

---

## Phase 24: GSAP Bubble Animations

Added GSAP-powered animations for the BottomBar pending text expand/collapse.

### GSAP Integration
- Installed `gsap` package (from public npm registry — CodeArtifact doesn't have it)
- Used GSAP Timeline for precise multi-property animation sequencing

### BottomBar Pending Text Animations

**Enter animation** (pending text appears):
- Block height: 0 → auto (350ms, power2.out)
- Block opacity: 0 → 1 (simultaneous)
- Outer gap: 0 → 20px (simultaneous)

**Exit animation** (card finalized, pending text disappears):
- Per-character blur(6px) + fade with stagger (300ms, 15ms stagger, power2.in)
- Speaker name blur(8px) + fade (250ms)
- Block height → 0 (400ms, power2.out, starts 100ms after text blur)
- Outer gap → 0 (simultaneous with height)

### Key Architecture Decision: Always-in-DOM Pending Block
- Pending block is always rendered in DOM (not conditionally mounted/unmounted)
- Hidden state: `height: 0, overflow: hidden, visibility: hidden`
- This prevents the flash/flicker that occurred when React removed DOM nodes after GSAP exit animations
- GSAP controls visibility via inline styles, React never adds/removes the element

### Flying Bubble Attempt (Abandoned)
- Tried implementing a "bubble split" animation where pending text flies from BottomBar to card area
- Approaches tried: motion `layoutId`, manual GSAP with fixed positioning, absolute positioning
- All had issues with position calculation or visibility
- Simplified to: bubble shrinks back + card appears in history simultaneously

### Changed Files
- `packages/electron-app/src/renderer/components/BottomBar.tsx`
- `packages/electron-app/src/renderer/components/LiveSession.tsx`
- `package.json` (gsap dependency)

---

## Phase 25: LiveSession Polish — Waveform, Animations, Micro-interactions

### Full-Width Waveform Above BottomBar
- Added wave mode to Waveform component: smooth organic bezier curves from time-domain audio data
- Only upper half (baseline at bottom, curves upward), filled with BottomBar color `#F0EDE8`
- EMA temporal smoothing (alpha=0.06) for slow, gentle movement
- Center 50% window with cosine fade at edges — no hard cutoff
- Replaces previous bar-style waveform and abandoned SVG wave edge / PulseLine approaches

### BottomBar Animation Tuning
- Bubble expand/collapse: GSAP `expo.out` ease, 0.8s duration
- Exit: per-character blur + fade with stagger, simultaneous height + gap collapse

### Listening Dots Animation
- "Listening" text with animated dots: 0→1→2→3 dots (0.5s each), pause 3s, then 3→2→1→0, pause 3s, loop
- Replaces static "Listening..." text

### End Button Hover
- Square icon scales up 20% on hover (`group-hover:scale-[1.2]` with transition)

### Changed Files
- `packages/electron-app/src/renderer/components/Waveform.tsx` (wave mode, color/idle props, bottom-aligned bars)
- `packages/electron-app/src/renderer/components/BottomBar.tsx` (ListeningDots, expo.out timing, Square hover)
- `packages/electron-app/src/renderer/components/LiveSession.tsx` (full-width waveform)
- `packages/electron-app/src/renderer/components/PulseLine.tsx` (kept but unused)
- `packages/electron-app/src/renderer/components/WaveEdge.tsx` (kept but unused)

---

## Phase 26: UI Polish — Icon Alignment, Animations, Scroll Clipping

### ExpandPanel X Icon Alignment
- X close button in drawer panel now positioned at exactly the same screen coordinates as the menu icon on HomeScreen
- Changed padding from `px-8 py-5` (32px/20px) to `px-[19px] py-[19px]` to match HomeScreen's `p-[9px]` outer + `p-[10px]` inner = 19px from window edge

### BottomBar Pending Height Animation (GSAP)
- Added ResizeObserver on pending text block to animate height changes when text grows (more lines added mid-display)
- Uses GSAP `expo.out` ease, 0.4s duration for smooth height transitions
- Added `tweening` guard flag to prevent ResizeObserver/GSAP feedback loop (observer detects GSAP height change → triggers new animation → infinite shaking)

### End Button Hover Timing
- Square icon hover scale transition changed to 400ms ease-out (was default 150ms CSS transition)

### LiveSession Scroll Clipping
- Added `overflow-hidden` to LiveSession outer container
- Prevents user from scrolling past the BottomBar's 100px negative margin sink area below the window edge

### Changed Files
- `packages/electron-app/src/renderer/components/ExpandPanel.tsx` (X icon padding alignment)
- `packages/electron-app/src/renderer/components/BottomBar.tsx` (ResizeObserver height animation, tweening guard, End hover 400ms)
- `packages/electron-app/src/renderer/components/LiveSession.tsx` (overflow-hidden)

---

## Phase 27: ExpandPanel Redesign, RecapScreen, History, Terminology

### ExpandPanel Overhaul
- Sign In button: uses global `normal` variant (bg #F0EDE8, text #5B5449, rounded-18, font-bold), `self-start` for content-width, `ml-3` to align left edge with SidebarButton text
- STT language selector restored: interactive radio-style (zh+en, en, zh, auto) replacing static placeholder text
- Settings and About: animated chevron icon (rotates -90° from left-pointing to down-pointing, 0.25s ease-out CSS transition)
- Settings and About content: max-height accordion animation (0→200px + opacity, 0.25s ease-out). Tried CSS grid `0fr→1fr` first but it failed intermittently when toggling between sections rapidly
- History and Terminology: click expands drawer panel to full width with same animation as vaul drawer open (0.5s cubic-bezier(0.32, 0.72, 0, 1)). Content switches to full-screen page with title + X close button. Close slides entire panel right (no intermediate menu state visible)
- X close button: 20px from right and bottom edges, matching menu icon position

### RecapScreen Redesign (from Figma)
- Title "Session recap": Lora 20px #60594D, pl-20 pt-12
- Cards grouped by speaker, same card format as LiveSession (category italic 11px + content medium 14px)
- Content area: px-20 outer + px-20 inner = 40px left padding for cards
- Bottom bar: "New session" ghost button (no background, plain text) + X close icon, px-20 pb-20 pt-12
- X icon has 300ms pointer-events-none on mount to prevent hover flash from End button overlap

### Global Padding Standardization
- All icon/button edge distances standardized to 20px (was 19px): HomeScreen outer padding, BottomBar px/py, ExpandPanel X icon, RecapScreen bottom bar
- HomeScreen morph animation endpoint updated to match (height 160, top innerHeight - 60)

### Other Changes
- Onboarding button text: "Start" → "Enter"
- Global Button default size: h-10 px-6 → min-h-[36px] px-4 (matches Start listening)
- End button hover: 400ms ease-out transition
- BottomBar pending height growth: GSAP ResizeObserver animation with tweening guard
- LiveSession: overflow-hidden to clip BottomBar sink area from scroll
- New icon components: chevron-icon.tsx (animated rotation), chevron-left-icon.tsx, chevron-down-icon.tsx (unused, kept)
- HistoryPage.tsx created (standalone, unused — history now lives inside ExpandPanel)

### Changed Files
- `packages/electron-app/src/renderer/components/ExpandPanel.tsx` (major rewrite)
- `packages/electron-app/src/renderer/components/RecapScreen.tsx` (redesign from Figma)
- `packages/electron-app/src/renderer/components/HomeScreen.tsx` (padding, animation endpoint)
- `packages/electron-app/src/renderer/components/BottomBar.tsx` (padding, GSAP height, End hover)
- `packages/electron-app/src/renderer/components/LiveSession.tsx` (overflow-hidden)
- `packages/electron-app/src/renderer/components/Onboarding.tsx` (Enter text)
- `packages/electron-app/src/renderer/components/ui/button.tsx` (default size)
- `packages/electron-app/src/renderer/components/ui/chevron-icon.tsx` (new)
- `packages/electron-app/src/renderer/components/ui/chevron-left-icon.tsx` (new)
- `packages/electron-app/src/renderer/components/ui/chevron-down-icon.tsx` (new)
- `packages/electron-app/src/renderer/components/HistoryPage.tsx` (new, unused)
- `packages/electron-app/src/renderer/App.tsx` (removed unused history screen)
- `packages/backend/src/ws/handler.ts` (whisperLang debug log)
