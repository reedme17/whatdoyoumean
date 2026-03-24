# UX Document — "What Do You Mean" (啥意思)

> Lo-fi wireframe spec. Black & white only, no stylized design elements. Built with shadcn/ui components.

## 1. Design Principles

- Extreme minimalism — the app should feel like a blank canvas that fills with meaning
- Zero chrome when listening — during a live session, nothing competes with the content
- Black & white only (lo-fi phase) — no colors, no gradients, no decorative elements
- shadcn/ui as the component library — consistent, accessible, unstyled-by-default

## 2. Mac App Screens

### 2.1 Login Screen

> Login is NOT the default entry point. The app opens directly to the Home Screen in guest mode. Login is accessed from the Expand Panel (≡) when the user wants to unlock additional features.

When triggered from the Expand Panel:
- Modal or inline section within the panel
- "Sign in with Apple" button (shadcn Button)
- "Sign in with Google" button (shadcn Button)
- "Sign in with Email" link below

### 2.2 Home Screen (Idle State — Default Entry Point)

The app opens directly here, no login required (guest mode):

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│                                         │
│              [ START ]                  │  ← large center button
│                                         │
│                                         │
│                                         │
│  [Text Mode]                    [≡]     │  ← bottom-left: text mode
│                                         │     bottom-right: expand/sign-in
└─────────────────────────────────────────┘
```

- **START button**: center of screen, large, works immediately in guest mode
- **Text Mode**: bottom-left corner — opens text paste view, works in guest mode
- **Expand icon (≡)**: bottom-right corner — opens side panel. In guest mode, the panel prominently shows "Sign In" at the top to unlock History, Memory, Sync, etc.

### 2.3 Live Session Screen (Listening)

After pressing START, the screen becomes a full canvas:

```
┌─────────────────────────────────────────┐
│                                         │
│  [Core meaning card]                    │
│                                         │
│  [Core meaning card]                    │
│                                         │
│  [Flow diagram / mind map]              │
│                                         │
│  [Core meaning card]                    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ [rec 1] [rec 2] [rec 3]        │    │  ← floating recommendation tokens
│  └─────────────────────────────────┘    │
│                                         │
│  ● Listening...    [⚑ Flag]  [■ Stop]   │  ← bottom bar
└─────────────────────────────────────────┘
```

- **Canvas area**: full screen, auto-scrolling, displays Core_Meaning_Cards and visualizations in real-time
  - **Card lifecycle**: while someone is speaking, the current Core_Meaning_Card updates in-place at the bottom of the canvas. When a significant pause occurs or another speaker starts talking, the current card is finalized and pushed up, and a new card begins below it. Old cards remain visible — scroll up to review them.
  - **Speaker indicator**: each card shows a small speaker label (e.g., "Speaker 1" or user-assigned name) at the top-left. When the speaker changes, the new card visually shows the different speaker, making turn-taking clear in the stream.
  - The canvas is a vertical stream: newest content at the bottom, oldest at the top
- **Recommendation tokens**: floating at the bottom of the canvas, above the bottom bar. Token-style buttons (shadcn Badge or Button variant). Tap to copy text. Refresh as new cards appear.
- **Bottom bar**:
  - Left: "● Listening..." status with subtle pulse
  - Center: **Flag button (⚑)** — creates a bookmark at the current moment
  - Right: **Stop button (■)**
- No raw transcript shown by default — only processed/extracted meaning

### 2.4 Recap Screen (After Stop)

When the user presses Stop, transitions to recap. Same layout as text mode results:

```
┌─────────────────────────────────────────┐
│  Session Recap              [Export] [✕] │
│─────────────────────────────────────────│
│                                         │
│  [Core meaning card — editable]         │
│                                         │
│  [Core meaning card — editable]         │
│                                         │
│  [Flow diagram / mind map]              │
│                                         │
│  [Core meaning card — editable]         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Recommendations                 │    │
│  │ [rec 1] [rec 2] [rec 3]        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [⚑ Flagged moments]                   │  ← if any flags were created
└─────────────────────────────────────────┘
```

- Same canvas layout as live session
- Cards are **editable** (click to edit content)
- **Export button**: top-right — exports as Markdown
- **Close (✕)**: returns to Home Screen, auto-saves to History
- **Recommendations**: shown as tokens at the bottom
- **Flagged moments**: listed if any flags were created during the session

### 2.5 Text Mode Screen

Accessed from Home Screen "Text Mode" link:

```
┌─────────────────────────────────────────┐
│  Text Mode                        [✕]   │
│─────────────────────────────────────────│
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Paste or type text here...      │    │  ← shadcn Textarea, large
│  │                                 │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│              [ Analyze ]                │
│                                         │
└─────────────────────────────────────────┘
```

After clicking Analyze, transitions to the **same Recap layout** with results (cards, recommendations, etc.).

### 2.6 Expand Panel (≡)

Slide-out side panel from the right (shadcn Sheet). Content varies by auth state:

**Guest mode (not signed in):**
```
┌──────────────────┐
│  [Sign In]       │  ← prominent sign-in button at top
│──────────────────│
│  Settings        │  ← language, STT mode (limited)
│──────────────────│
│  About           │
│──────────────────│
│                  │
│  History 🔒      │  ← locked, shows "Sign in to unlock"
│  Profile 🔒      │
│  Terminology 🔒  │
└──────────────────┘
```

**Signed in:**
```
┌──────────────────┐
│  Profile         │  ← user info, frequent topics, action items
│──────────────────│
│  History         │  ← list of past sessions
│──────────────────│
│  Settings        │  ← full settings
│──────────────────│
│  Terminology     │  ← learned terms dictionary
│──────────────────│
│  About           │
│──────────────────│
│  Sign Out        │
└──────────────────┘
```

### 2.7 History View

Accessed from Expand Panel → History:

```
┌─────────────────────────────────────────┐
│  History                    [Search 🔍] │
│─────────────────────────────────────────│
│  Mar 23, 2026 — 45min — Product Launch  │  ← tap to open recap
│  Mar 22, 2026 — 12min — Budget Review   │
│  Mar 21, 2026 — 8min — (text mode)      │
│  ...                                    │
└─────────────────────────────────────────┘
```

Tapping a session opens it in the Recap view.

## 3. Mac Menu Bar

> Deferred to a future iteration. This lo-fi version focuses on the main window only.

## 4. Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Start/Stop session | ⌘ + Shift + S |
| Flag current moment | ⌘ + B |
| Text Mode | ⌘ + T |
| Export | ⌘ + E |
| Toggle expand panel | ⌘ + / |

## 5. Open Questions (TBD)

- Should raw transcript be visible during live session? Toggle? Separate view?
- Topic map — when is it shown? Separate view? Part of recap? Overlay?
- Card editing in recap — inline editing or modal?
- Flag — should it capture a note/label, or just a timestamp marker?

## 6. iOS App

> Deferred — will be designed after Mac app UX is validated.

## 7. Visual Design System

> Lo-fi phase: black & white only, shadcn/ui defaults.
> Color palette, typography, iconography, animations will be defined in a future hi-fi phase.
