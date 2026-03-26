# Bug Report: Button-to-BottomBar Morph Animation

## Symptom
"Start listening" button morph animation to BottomBar had multiple issues: border-radius dropping to 0 mid-animation, and position "teleporting" (瞬移) when transitioning from HomeScreen to LiveSession.

## Root Cause Analysis

### Issue 1: Border-radius dropping to 0
- **Approach tried**: `layoutId` shared between `motion.button` (HomeScreen) and `motion.div` (BottomBar)
- **Problem**: When screen switches, the old element unmounts and new one mounts. During the gap between unmount/mount, motion can't interpolate — border-radius jumps to 0 before reaching the target value.
- **Also**: CSS class `rounded-full` (9999px) and inline `style={{ borderRadius }}` on the target don't interpolate well together. Motion needs both values in the same format (both in `style`).

### Issue 2: Position teleporting (瞬移)
- **Approach tried**: `layoutId` with `LayoutGroup` wrapper
- **Problem**: The two elements use different layout systems — button is in a flex-centered container, BottomBar is a flex child at the bottom. `layoutId` calculates position from DOM layout, but the intermediate state during screen switch has no valid position.
- **Approach tried**: Manual animation with `transform: translateY()` 
- **Problem**: `translateY` is relative to the element's original position in flex layout. The button is centered by flex, so the offset calculation was wrong — didn't account for the button not being at (0,0).
- **Approach tried**: Manual animation with `position: fixed` + absolute screen coordinates
- **This worked**: Fixed positioning removes all layout dependencies. `getBoundingClientRect()` gives exact screen position of the button, and the animation target uses `window.innerHeight` for exact bottom position.

### Issue 3: Animation endpoint mismatch
- **Problem**: Animation ends at fixed position `(top: X, left: 0, width: W, height: H)`, but BottomBar renders in flex layout. Even 1px difference causes a visible jump.
- **Fix**: Animation target must exactly match BottomBar's rendered position. For a 48px bar at the bottom: `top: window.innerHeight - 48`. When BottomBar has extra height (148px with -mb-[100px]), animation target must be `top: innerHeight - 48, height: 148`.

## Final Solution
1. On click, read button's screen position via `getBoundingClientRect()`
2. Switch button to `position: fixed` at its current screen coordinates
3. Animate `top/left/width/height/borderRadius` to match BottomBar's exact position
4. All values in `style` prop (not CSS classes) so motion can interpolate
5. Animation complete → call `onStart()` to switch to LiveSession
6. BottomBar renders in the same position — no jump

## Lesson Learned
- `layoutId` doesn't work well across screen transitions (mount/unmount gap)
- For cross-screen morph animations, use `position: fixed` + absolute coordinates
- Animation endpoint must be calculated from the target component's actual rendered position, not the other way around
- Border-radius must be in `style` prop (not Tailwind classes) for motion to interpolate
- `whileTap: { scale: 0.96 }` can cause text wrapping — add `whitespace-nowrap`

## Changed Files
- `packages/electron-app/src/renderer/components/HomeScreen.tsx`
- `packages/electron-app/src/renderer/components/BottomBar.tsx`
- `packages/electron-app/src/renderer/components/ui/button.tsx`
- `packages/electron-app/src/renderer/App.tsx`
