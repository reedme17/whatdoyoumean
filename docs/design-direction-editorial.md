# 啥意思 — Editorial Design Direction

## Concept

The app feels like reading a beautifully typeset magazine that writes itself in real time. Each card is a "pull quote" — the kind you'd see in The New Yorker or Monocle. The interface recedes; the content speaks.

## Typography

Display font: **Playfair Display** (serif, dramatic, editorial weight)
- Used for: app title "啥意思", card content, headings
- Weight: 400 for body, 700 for emphasis

Body font: **Source Sans 3** (clean humanist sans-serif)
- Used for: UI labels, badges, buttons, metadata
- Weight: 300 light for metadata, 400 regular for UI, 600 semibold for actions

Chinese fallback: **Noto Serif SC** (pairs with Playfair's editorial feel)

```css
--font-display: "Playfair Display", "Noto Serif SC", Georgia, serif;
--font-body: "Source Sans 3", "Noto Sans SC", sans-serif;
```

## Color Palette

Warm paper tones, not cold digital white. Ink-like contrast.

```css
--color-background: #FAF8F5;     /* warm cream paper */
--color-foreground: #1A1A1A;     /* near-black ink */
--color-muted: #8C8578;          /* warm gray, like pencil */
--color-border: #E8E4DE;         /* subtle warm divider */
--color-accent: #C4553A;         /* editorial red — used sparingly */
--color-accent-foreground: #FAF8F5;
--color-card: #FFFFFF;           /* slightly brighter than bg for lift */
--color-card-foreground: #1A1A1A;
--color-secondary: #F0ECE6;     /* warm off-white for hover states */
```

The red accent (#C4553A) is used only for:
- The recording indicator dot
- Flag (⚑) button when active
- Category badges for "disagreement" and "action_item"
- The waveform bars during speech

Everything else stays in the warm grayscale.

## Spatial Composition

- Generous margins — cards don't touch edges, 32px+ side padding
- Cards have no visible border by default — separated by whitespace alone
- A thin 1px warm-gray rule between cards (like column dividers in a newspaper)
- Category badge sits as a small uppercase label above the card content, like a section header in a magazine
- Speaker name in italic, like a byline

## Card Design

```
  OPINION                          ← uppercase, letter-spaced, Source Sans 3, 10px, muted
  Speaker 1                        ← italic, Source Sans 3, 12px, muted

  "We should reconsider the        ← Playfair Display, 16px, 1.6 line-height
   timeline for the Q3 launch."      content feels like a pull quote

  ────────────────────────────     ← thin warm rule, not a box border
```

No box borders. No rounded corners on cards. The editorial look is flat, typographic, ruled.

## Motion

- Cards fade in from below with a subtle 300ms ease-out (opacity 0→1, translateY 8px→0)
- Pending preview text has a gentle pulse opacity (0.4 → 0.7) like a cursor blink
- Page transitions: crossfade 200ms
- Waveform bars: smooth frequency animation (already implemented)
- No bouncy/springy animations — everything is measured, calm, editorial

## Home Screen

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│                                         │
│              啥意思                      │  ← Playfair Display, 72px, light
│           What Do You Mean              │  ← Source Sans 3, 13px, letter-spaced, muted
│                                         │
│              [ BEGIN ]                  │  ← uppercase, letter-spaced, bordered
│                                         │
│          🎤 Microphone Only             │  ← small toggle, muted
│                                         │
│                                         │
│  Text Mode                        ≡     │
└─────────────────────────────────────────┘
```

- "BEGIN" instead of "START" — more editorial
- Generous vertical centering, lots of breathing room
- Background: warm cream (#FAF8F5)

## Live Session

- Cards stack vertically with thin rules between them
- Pending preview: italic, lighter opacity, no border
- Bottom bar: waveform left, flag center (⚑ in accent red when active), stop right
- Recommendation tokens: small uppercase pills, warm gray border

## Recap

- Same card layout as live, but cards are slightly larger (18px font)
- "Session Recap" as a large serif heading
- Export button: understated, outline style
- Flagged moments: shown as timestamps with a small red ⚑ marker

## Processing Screen

- "Processing..." in Playfair Display italic, centered
- A thin horizontal line that slowly expands from center (like a loading bar in a magazine spread)

## Expand Panel

- Slides from right, warm cream background
- Menu items: Source Sans 3, uppercase, letter-spaced, generous padding
- Active item: accent red underline, not background highlight
- Clean, no icons — text only

## Google Fonts to Load

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;600&family=Noto+Serif+SC:wght@400;700&display=swap" rel="stylesheet">
```

## What Makes This Unforgettable

The moment someone sees their conversation rendered as elegant pull quotes on warm paper — not as chat bubbles or transcript lines — they'll understand this isn't another note-taking app. It's a meaning distillery with the aesthetic sensibility of a literary magazine.
