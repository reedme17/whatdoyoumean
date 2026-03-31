# Bug Report: iOS Button Morph Animation Jump

## Summary

When transitioning from HomeScreen to LiveSession, the "Start listening" button morphs into the BottomBar. The morph bar's end position must pixel-perfectly overlap with the BottomBar in LiveSession, otherwise a visible jump occurs at the moment of screen switch.

## Root Cause

SwiftUI's coordinate systems differ between contexts:

1. **GeometryReader inside safe area**: `frame(in: .global)` returns coordinates relative to the safe area, not the physical screen. A GeometryReader placed inside a VStack has its origin offset by the top safe area inset (e.g., 59pt for Dynamic Island).

2. **GeometryReader with `.ignoresSafeArea()`**: Returns coordinates relative to the full physical screen (0,0 = top-left corner of display).

3. **BottomBar uses `.ignoresSafeArea(edges: .bottom)`**: Its background extends below the safe area into the home indicator region. The morph bar must do the same.

## Failed Approaches

1. **`matchedGeometryEffect`**: No support for custom timing curves (spring overshoot). SwiftUI controls the interpolation entirely.

2. **Manual lerp with GeometryReader-relative coords**: The GeometryReader's origin was inside the safe area, so converting global button coordinates to local coordinates introduced an offset equal to the top safe area inset. The morph bar ended up ~59pt too high.

3. **Hardcoded screen dimensions**: Fragile, breaks on different devices.

4. **`.transition(.move(edge: .bottom))`**: Slides from off-screen, not from the button position. Doesn't match the Mac version's morph animation.

## Solution

1. **Measure the real BottomBar position** by adding a `GeometryReader` overlay to BottomBar that prints `frame(in: .global)`. This gave: `x=0, y=756, w=402, h=84, maxY=840`.

2. **Place the morph bar in an `.overlay` with `.ignoresSafeArea()`**: The overlay's GeometryReader operates in full-screen coordinates, matching the global coordinate space used by `frame(in: .global)`.

3. **Lerp from button's global frame to BottomBar's global frame**: No coordinate conversion needed since both are in the same space.

4. **Extend morph bar to physical screen bottom**: Use the overlay GeometryReader's `size.height` (which is the full physical screen height due to `.ignoresSafeArea()`) to compute `endH = trueScreenBottom - endY`, ensuring the morph bar covers the home indicator area just like BottomBar does.

## Key Lesson

When animating between two views that span different safe area contexts, always:
- Measure the target view's actual global frame first
- Place the animated element in an `.ignoresSafeArea()` overlay so its coordinate system matches global coordinates
- Never convert between safe-area-relative and global coordinates manually — use the same coordinate space for both source and target

## Files Changed

- `HomeScreen.swift`: Morph animation with overlay-based positioning
- `BottomBarView.swift`: Added debug GeometryReader for position measurement, `.ignoresSafeArea(edges: .bottom)` on background
