# Bug Report: UI Migration & Audio Pipeline Issues

Date: 2026-03-25

## Summary

After migrating from inline styles to shadcn/ui + Tailwind CSS v4, and implementing silence-based card generation, a series of UI rendering and audio pipeline bugs surfaced. 7 bugs total, all resolved.

---

## Bug 1: CSS Layer Priority — Tailwind Utilities Overridden by Reset

**Symptom**: All padding, margin, and spacing from Tailwind utility classes (px-5, py-3, etc.) had no effect. UI looked completely unstyled — no padding anywhere.

**Root Cause**: `globals.css` had a `* { margin: 0; padding: 0; }` reset outside of any CSS layer. Tailwind v4 utilities are inside `@layer utilities`. CSS spec says unlayered styles have higher priority than layered styles, so the `*` reset always won.

**Fix**: Moved the reset into `@layer base { ... }`. Since `@layer base` has lower priority than `@layer utilities`, Tailwind classes now correctly override the reset.

**Lesson**: When using Tailwind v4's layer system, all custom CSS resets must be inside `@layer base`, never unlayered.

---

## Bug 2: Tailwind CLI Not Found via npx on Node 18

**Symptom**: `npx @tailwindcss/cli` prompted "Need to install the following packages" and failed when user cancelled.

**Root Cause**: User's terminal was running Node 18 (via nvm) instead of Node 22 (via mise). npx on Node 18 didn't find the locally installed `@tailwindcss/cli` package.

**Fix**: Changed `build-renderer.mjs` to use the local binary directly: `node ../../node_modules/@tailwindcss/cli/dist/index.mjs` instead of `npx @tailwindcss/cli`.

**Lesson**: Don't rely on npx for build-critical tools. Reference local node_modules binaries directly.

---

## Bug 3: desktopCapturer AudioContext Crash

**Symptom**: `The AudioContext encountered an error from the audio device or the WebAudio renderer.` Recording stopped after 0.1 seconds with only 1365 samples (4KB).

**Root Cause**: Electron 33 + macOS — mixing desktopCapturer system audio with microphone audio via AudioContext ChannelMerger causes an immediate AudioContext error. The system audio stream from `chromeMediaSource: "desktop"` is incompatible with the AudioContext's audio graph.

**Fix**: Disabled system audio capture by default. Added UI toggle on HomeScreen: "🎤 Mic Only" (default, stable) vs "🎤🔊 Mic + System" (experimental). System audio only attempted when user explicitly enables it.

**Lesson**: desktopCapturer audio capture on macOS is fragile. Consider AudioWorklet or Electron 34+ for future attempts.

---

## Bug 4: Whisper Silence Hallucination

**Symptom**: During silence, Groq Whisper transcribed phantom phrases ("Thank you", "You") every 4 seconds.

**Root Cause**: Frontend sent audio chunks every 4 seconds regardless of volume. Whisper is known to hallucinate short phrases when given pure silence as input.

**Fix**: Added RMS energy calculation in `useAudioCapture.ts`. Chunks with RMS below 0.005 are silently dropped before sending to backend.

**Lesson**: Always filter silent audio before sending to STT APIs. Whisper hallucination on silence is a well-known issue.

---

## Bug 5: Duplicate Cards in LiveSession

**Symptom**: Each new card appeared twice — one with gray border (opacity-95) and one with black border.

**Root Cause**: `card:created` handler both pushed to `cards[]` AND set `currentCard`. LiveSession rendered both `cards.map()` and `{currentCard && <Card>}` separately, showing the same card twice with different styles.

**Fix**: Removed `setCurrentCard(newCard)` from `card:created` handler. The `currentCard` concept was replaced by `pendingPreview` for live text display.

---

## Bug 6: Late Cards Appearing in Recap

**Symptom**: After pressing Stop and entering recap, new cards would appear seconds later, changing the recap content.

**Root Cause**: Multiple issues stacked:
1. Backend's 5-second silence timer could fire after session:end, generating a late card
2. `finalizePendingText` in session:end was not awaited (called without `await`)
3. Frontend's `card:created` handler accepted cards on any screen
4. `detectDuplicate` asynchronously modified existing card content

**Fix**:
1. session:end handler changed to `async`, `await finalizePendingText()` before emitting session:ended
2. Added "processing" screen between Stop and Recap — waits for `session:state: ended` event
3. `card:created` only accepted on "live", "text", or "processing" screens
4. Disabled `detectDuplicate` entirely

---

## Bug 7: pending:preview Event Not Received

**Symptom**: Live transcript preview (dashed border text) never appeared during recording.

**Root Cause**: `useSocket.ts` has a hardcoded `eventTypes` array listing which Socket.IO events to listen for. `pending:preview` was not in the list, so the socket never registered a listener for it.

**Fix**: Added `"pending:preview"` to the `eventTypes` array in `useSocket.ts`.

**Lesson**: When adding new server event types, remember to update BOTH `shared/events.ts` (type definition) AND `useSocket.ts` (event listener registration).

---

## Changed Files Summary

| File | Changes |
|------|---------|
| `packages/electron-app/src/renderer/globals.css` | Moved CSS reset into `@layer base`; added `padding-top: 38px` to `#root` |
| `packages/electron-app/build-renderer.mjs` | Use local Tailwind CLI binary instead of npx |
| `packages/electron-app/src/renderer/hooks/useAudioCapture.ts` | Added RMS silence detection; disabled system audio by default; added `captureSystem` flag |
| `packages/electron-app/src/renderer/App.tsx` | Added "processing" screen; screen-aware card:created handler; removed currentCard duplication |
| `packages/electron-app/src/renderer/hooks/useSocket.ts` | Added `pending:preview` to event listener list |
| `packages/backend/src/ws/handler.ts` | Async session:end; silence timer; pending:preview emission |
| `packages/shared/src/events.ts` | Added `pending:preview` event type |
