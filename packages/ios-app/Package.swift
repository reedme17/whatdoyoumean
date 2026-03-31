// swift-tools-version: 5.10
// This Package.swift is for reference only — the actual dependency management
// happens in the Xcode project via SPM (File → Add Package Dependencies).
//
// Required package:
//   https://github.com/socketio/socket.io-client-swift
//   Branch: master (for Swift 5.10+ / iOS 17+ support)
//
// To set up:
// 1. Open Xcode → File → New → Project → iOS → App
//    - Product Name: WhatDoYouMean
//    - Interface: SwiftUI
//    - Language: Swift
//    - Minimum Deployment: iOS 17.0
//
// 2. Delete the auto-generated ContentView.swift and WhatDoYouMeanApp.swift
//
// 3. Drag the WhatDoYouMean/ folder into the Xcode project navigator
//
// 4. File → Add Package Dependencies → paste:
//    https://github.com/socketio/socket.io-client-swift
//    Select branch: master
//
// 5. Build & Run (Cmd+R)

import PackageDescription

let package = Package(
    name: "WhatDoYouMean",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(url: "https://github.com/socketio/socket.io-client-swift", branch: "master"),
    ],
    targets: [
        .executableTarget(
            name: "WhatDoYouMean",
            dependencies: [
                .product(name: "SocketIO", package: "socket.io-client-swift"),
            ],
            path: "WhatDoYouMean"
        ),
    ]
)
