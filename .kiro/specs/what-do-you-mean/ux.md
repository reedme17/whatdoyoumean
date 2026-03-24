# UX Document — "What Do You Mean" (啥意思)

> This document is a framework/skeleton. Detailed interaction patterns, visual design, and UI specifications will be filled in as the UX vision solidifies.

## 1. Design Principles

- TODO: Define core UX principles (e.g., minimal distraction, glanceable, real-time-first)
- TODO: Define information hierarchy — what's most important on screen at any moment

## 2. User Flows

### 2.1 First-Time Onboarding
- TODO: Onboarding screens (max 3), permission requests, language/preference setup

### 2.2 Start a Live Session (Audio)
- TODO: Session mode selection (online vs offline) → microphone permission → recording starts → real-time panel appears

### 2.3 Text Input Mode (Paste & Analyze)
- TODO: Text input entry point → paste/type → submit → results display

### 2.4 Review Past Session
- TODO: Session list → open session → browse transcript/cards/recommendations → bookmarks/highlights

### 2.5 Settings & Profile
- TODO: Settings screen layout, User_Profile view, Terminology dictionary management

## 3. Screen Layouts

### 3.1 Conversation Flow Panel (Live Session)
- TODO: Layout for the unified real-time stream (transcript + Core_Meaning_Cards + recommendations)
- TODO: Auto-scroll behavior, "jump to latest" button placement
- TODO: Stream filter toggles (show/hide transcript, meanings, recommendations)
- TODO: Session controls (start/pause/resume/end) placement
- TODO: Session timer, microphone indicator

### 3.2 Core_Meaning_Card Design
- TODO: Card visual design — compact vs expanded state
- TODO: Category indicators (事实陈述, 观点, 问题, 决定, 待办事项, 分歧)
- TODO: Linked card indicators (contradicts, modifies, extends)
- TODO: Tap-to-expand interaction (show source transcript segments)

### 3.3 Visualization Formats
- TODO: Concise text card layout
- TODO: Flow diagram / mind-map style card layout
- TODO: Format switching interaction (if supported)

### 3.4 Recommendation Cards
- TODO: Recommendation card visual design
- TODO: Category badges (追问, 澄清, 新提议, 质疑/反驳, 总结确认, 话题转换)
- TODO: Tap-to-copy interaction and confirmation feedback

### 3.5 Topic Map View
- TODO: Interactive mind map / graph layout
- TODO: Topic node design, relationship lines
- TODO: Tap-to-navigate interaction (topic node → scroll to transcript)

### 3.6 Session Archive List
- TODO: Session list item design (date, duration, topic summary)
- TODO: Search bar and results display
- TODO: Swipe-to-delete, export action

### 3.7 Bookmarks & Highlights
- TODO: Bookmark creation interaction (button placement during live session)
- TODO: Highlight interaction (long-press on card, color picker)
- TODO: Filtered view for bookmarks/highlights within a session

### 3.8 User Profile & Memory
- TODO: User_Profile summary view (frequent topics, common speakers, action items)
- TODO: Memory entry list and delete interaction
- TODO: Terminology dictionary view (auto-learned terms, manual additions)

## 4. Platform-Specific Considerations

### 4.1 Mac App (Electron)
- TODO: Window layout and sizing
- TODO: Keyboard shortcuts mapping
- TODO: System tray / menu bar integration
- TODO: macOS permission prompts (Screen Recording, Microphone)
- TODO: Background audio capture behavior

### 4.2 iOS App
- TODO: iPhone vs iPad layout differences
- TODO: Dynamic Type support
- TODO: iOS share sheet integration for export
- TODO: Background/foreground transition behavior

## 5. Accessibility

- TODO: VoiceOver / screen reader flow for live session
- TODO: Contrast ratios and color palette
- TODO: Touch target sizes (44x44pt minimum)
- TODO: Screen reader announcements for new cards during live session

## 6. Visual Design System

- TODO: Color palette (light/dark mode)
- TODO: Typography scale
- TODO: Iconography
- TODO: Card styles, borders, shadows
- TODO: Animation and transition guidelines
