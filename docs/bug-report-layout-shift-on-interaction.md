# Bug Report: Layout Shift on Panel Open and Button Morph

## Symptom 1: Background sinks when drawer panel opens
Clicking the menu icon to open the ExpandPanel caused the entire HomeScreen content to shift down ~15px.

### Root Cause
The menu icon was conditionally rendered: `{!panelOpen && <button>...</button>}`. When `panelOpen` became true, the button DOM node was removed. The bottom section of the flex layout (`justify-between`) lost height, causing the middle content to redistribute and shift down.

### Fix
Changed from conditional rendering to `visibility: hidden`:
```tsx
// Before (causes layout shift)
{!panelOpen && <button>...</button>}

// After (preserves layout)
<button style={{ visibility: panelOpen ? "hidden" : "visible" }}>...</button>
```

## Symptom 2: Tagline sinks when "Start listening" is clicked
Clicking the button caused the tagline "Ready to interpret for you." to shift down before fading out.

### Root Cause
The button switches to `position: fixed` for the morph animation. When it leaves the flex flow, the remaining elements (tagline + keyboard icon) re-center in the flex container, causing a visible shift.

### Fix
Added a placeholder div that maintains the button's original dimensions when it goes fixed:
```tsx
<div style={placeholderSize ? { width: w, height: h } : undefined}>
  <motion.button style={morphStyle ?? { borderRadius: 18 }}>...</motion.button>
</div>
```

## Symptom 3: Keyboard icon shifts left during button morph
After the button goes fixed, the keyboard icon moved slightly left as the flex container re-centered.

### Root Cause
Even with the placeholder div, the keyboard icon was still in the flex flow. The placeholder + gap + keyboard icon had slightly different centering than the original button + gap + keyboard icon (because the fixed-position button's text was fading out, changing its intrinsic width).

### Fix
Record the keyboard icon's screen position before the animation starts, then fix it in place with `position: fixed`:
```tsx
const kbRect = kbRef.current.getBoundingClientRect();
setKbFixedStyle({ position: "fixed", top: kbRect.top, left: kbRect.left, zIndex: 9998 });
```

## Lesson Learned
- Conditional rendering (`{condition && <element>}`) causes layout shifts — use `visibility: hidden` instead
- When elements leave flex flow (via `position: fixed/absolute`), always leave a same-sized placeholder
- For pixel-perfect animations, fix ALL nearby elements in place, not just the animated one
- Record positions with `getBoundingClientRect()` before any state changes

## Changed Files
- `packages/electron-app/src/renderer/components/HomeScreen.tsx`
- `packages/electron-app/src/renderer/components/ui/drawer.tsx`
