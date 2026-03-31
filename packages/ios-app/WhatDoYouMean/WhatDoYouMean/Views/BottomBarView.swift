import SwiftUI

struct BottomBarView: View {
    @Environment(AppState.self) private var appState
    @State private var showMarkedToast = false
    @State private var elapsedSeconds: Int = 0
    @State private var timer: Timer?
    @State private var dotCount: Int = 1
    @State private var dotTimer: Timer?
    @State private var durationVisible: Bool = true
    @State private var hideTask: DispatchWorkItem?
    @State private var showSettings = false

    var body: some View {
        HStack {
            // Left: "Listening..." + duration
            Button {
                // Touch to show duration
                showDuration()
            } label: {
                HStack(spacing: 0) {
                    Text("Listening")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .semibold))
                        .foregroundStyle(Tokens.Colors.warmTextLight)
                    Text(String(repeating: ".", count: dotCount))
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .semibold))
                        .foregroundStyle(Tokens.Colors.warmTextLight)
                        .frame(width: 20, alignment: .leading)
                    Text("(\(formatDuration(elapsedSeconds)))")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .semibold))
                        .foregroundStyle(Tokens.Colors.warmTextLight)
                        .opacity(durationVisible ? 1 : 0)
                        .animation(.easeInOut(duration: 0.5), value: durationVisible)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

            // Center: Mark moment
            PressableBarButton {
                withAnimation { showMarkedToast = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation { showMarkedToast = false }
                }
            } content: { pressed in
                MapPinPlusIcon(size: 20, color: pressed ? Tokens.Colors.warmText : Tokens.Colors.warmTextLight)
                    .allowsHitTesting(false)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Mark this moment")
            .overlay(alignment: .top) {
                if showMarkedToast {
                    Text("Moment marked")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.xs))
                        .foregroundStyle(Tokens.Colors.warmText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(.white.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.md))
                        .shadow(radius: 2)
                        .fixedSize()
                        .offset(y: -34)
                        .transition(
                            .asymmetric(
                                insertion: .opacity.combined(with: .offset(y: 4)).animation(.easeOut(duration: 0.2)),
                                removal: .opacity.animation(.easeIn(duration: 0.3))
                            )
                        )
                }
            }

            // Right: Sliders + End
            HStack(spacing: Tokens.Spacing.lg) {
                Button {
                    showSettings.toggle()
                } label: {
                    SlidersIcon(size: 18, color: showSettings ? Tokens.Colors.warmText : Tokens.Colors.warmTextLight)
                        .allowsHitTesting(false)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Settings")
                .popover(isPresented: $showSettings, attachmentAnchor: .point(.top), arrowEdge: .bottom) {
                    SettingsControls(variant: .full)
                        .padding(Tokens.Spacing.lg)
                        .presentationCompactAdaptation(.popover)
                }

                PressableBarButton {
                    appState.endSession()
                } content: { pressed in
                    HStack(spacing: 6) {
                        SquareIcon(size: 12, color: pressed ? Tokens.Colors.warmText : Tokens.Colors.warmTextLight)
                        Text("End")
                            .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .semibold))
                            .foregroundStyle(pressed ? Tokens.Colors.warmText : Tokens.Colors.warmTextLight)
                    }
                    .frame(height: 44)
                    .contentShape(Rectangle())
                }
                .accessibilityLabel("Stop session")
            }
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, Tokens.Spacing.xl)
        .padding(.vertical, Tokens.Spacing.xl)
        .background(
            Tokens.Colors.warmBg
                .clipShape(
                    UnevenRoundedRectangle(
                        topLeadingRadius: Tokens.Radius.xl,
                        topTrailingRadius: Tokens.Radius.xl
                    )
                )
                .ignoresSafeArea(edges: .bottom)
        )
        .onAppear {
            startTimer()
            startDotAnimation()
            // Auto-show duration for 5s then hide
            scheduleHide(after: 5)
        }
        .onDisappear {
            stopTimer()
            dotTimer?.invalidate()
            hideTask?.cancel()
        }
        .background(
            GeometryReader { geo in
                Color.clear.onAppear {
                    let f = geo.frame(in: .global)
                    print("[BottomBar] global frame: x=\(f.minX) y=\(f.minY) w=\(f.width) h=\(f.height) maxY=\(f.maxY)")
                }
            }
        )
    }

    private func showDuration() {
        hideTask?.cancel()
        durationVisible = true
        scheduleHide(after: 3)
    }

    private func scheduleHide(after seconds: Double) {
        hideTask?.cancel()
        let task = DispatchWorkItem {
            durationVisible = false
        }
        hideTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: task)
    }

    private func startTimer() {
        elapsedSeconds = 0
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if let start = appState.sessionStartTime {
                elapsedSeconds = Int(Date().timeIntervalSince(start))
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func startDotAnimation() {
        dotTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            dotCount = dotCount % 3 + 1
        }
    }

    private func formatDuration(_ totalSec: Int) -> String {
        let h = totalSec / 3600
        let m = (totalSec % 3600) / 60
        let s = totalSec % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%02d:%02d", m, s)
    }
}

/// Pressable button that passes press state to content, allowing real color changes.
struct PressableBarButton<Content: View>: View {
    let action: () -> Void
    @ViewBuilder let content: (Bool) -> Content
    @State private var pressed = false

    var body: some View {
        content(pressed)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in pressed = true }
                    .onEnded { _ in
                        pressed = false
                        action()
                    }
            )
    }
}
