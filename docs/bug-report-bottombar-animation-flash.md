# Bug Report: BottomBar Animation Flash on Pending Text Exit

## Symptom
When pending text disappears from the BottomBar (card finalized), there's a visible flash/flicker at the end of the shrink animation.

## Root Cause
The pending text block was conditionally rendered (`{showPending && <div>...</div>}`). When the exit animation completed, `setExitingText(null)` triggered React to remove the DOM node. Between the last GSAP frame (height: 0) and React's DOM removal, there was a single frame where:
1. `clearProps: "all"` restored the block to its natural height
2. React then removed it

This one-frame flash of the block at full height was visible.

## Approaches Tried

### 1. clearProps before setState
- Tried calling `gsap.set(block, { clearProps: "all" })` before `setExitingText(null)` in the same synchronous callback
- Failed: Both execute in the same microtask, but the browser renders the cleared state before React processes the state update

### 2. motion layout + AnimatePresence
- Tried using framer-motion's `layout` prop on the outer container + `AnimatePresence` for the pending block
- Failed: `motion layout` didn't reliably detect height changes, and the animation was inconsistent

### 3. Separate gap animation
- Added GSAP animation for the `gap` property alongside height
- Partially helped but the DOM removal still caused a flash

## Final Solution
Keep the pending block always in the DOM. Never mount/unmount it.

- Initial state: `height: 0, overflow: hidden, visibility: hidden`
- Enter: GSAP animates `visibility: visible`, `height: 0 → auto`, `opacity: 0 → 1`, `gap: 0 → 20`
- Exit: GSAP animates per-char blur + fade, `height → 0`, `gap → 0`, then sets `visibility: hidden`
- No React conditional rendering = no DOM add/remove = no flash

## Lesson Learned
- Conditional rendering (`{condition && <Component />}`) and GSAP exit animations don't mix well
- GSAP animates DOM properties directly, but React controls DOM existence — the two can conflict on the frame boundary
- For smooth exit animations, keep elements in DOM and use `visibility: hidden` + `height: 0` instead of unmounting

## Changed Files
- `packages/electron-app/src/renderer/components/BottomBar.tsx`
