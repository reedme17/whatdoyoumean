# 啥意思 iOS App

SwiftUI native iOS client for the 啥意思 (What Do You Mean) real-time conversation understanding tool.

## Prerequisites

- macOS 14+ (Sonoma)
- Xcode 16+ (from Mac App Store)
- iOS 17+ device or simulator

## Setup

### 1. Create Xcode Project

```
File → New → Project → iOS → App
```

- Product Name: `WhatDoYouMean`
- Interface: SwiftUI
- Language: Swift
- Minimum Deployment: iOS 17.0

### 2. Add Source Files

Delete the auto-generated `ContentView.swift` and `WhatDoYouMeanApp.swift`, then drag the `WhatDoYouMean/` folder from this directory into the Xcode project navigator.

### 3. Add Socket.IO Dependency

```
File → Add Package Dependencies
```

Paste: `https://github.com/socketio/socket.io-client-swift`

Select branch: `master`

### 4. Configure Info.plist

The `Info.plist` is already included with microphone and local network permissions.

### 5. Run Backend

```bash
# From project root
npm run dev:backend
```

### 6. Configure Server URL

For simulator: `http://localhost:3001` works.

For real device: find your Mac's IP (`ifconfig | grep inet`) and update the URL in `SocketService.swift`.

### 7. Build & Run

`Cmd+R` in Xcode.

## Architecture

```
WhatDoYouMean/
├── WhatDoYouMeanApp.swift    # @main entry
├── ContentView.swift          # Root router
├── Models/
│   ├── AppState.swift         # Observable app state
│   ├── SharedTypes.swift      # Data models (from @wdym/shared)
│   └── DesignTokens.swift     # Design system (from shared/tokens.ts)
├── Services/
│   ├── SocketService.swift    # Socket.IO client (↔ useSocket.ts)
│   └── AudioCaptureService.swift  # AVAudioEngine (↔ useAudioCapture.ts)
└── Views/
    ├── HomeScreen.swift       # ↔ HomeScreen.tsx
    ├── LiveSessionScreen.swift # ↔ LiveSession.tsx
    ├── BottomBarView.swift    # ↔ BottomBar.tsx
    ├── CoreMeaningCardRow.swift # ↔ CoreMeaningCard.tsx
    ├── TextModeScreen.swift   # ↔ TextModeScreen.tsx
    ├── RecapScreen.swift      # ↔ RecapScreen.tsx
    └── HistoryScreen.swift    # ↔ ExpandPanel.tsx / HistoryView.tsx
```

The iOS app is a pure client — the Node.js backend handles all STT, LLM, and session logic. Communication is via Socket.IO, identical to the Electron renderer.
