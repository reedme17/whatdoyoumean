import SwiftUI

/// Bottom bar — mirrors BottomBar.tsx.
/// Shows listening indicator, mark moment, settings, and end button.
struct BottomBarView: View {
    @Environment(AppState.self) private var appState
    @State private var showMarkedToast = false
    @State private var elapsedSeconds: Int = 0
    @State private var timer: Timer?

    var body: some View {
        HStack {
            // Listening indicator with elapsed time
            HStack(spacing: 6) {
                ListeningDots()
                Text(formatDuration(elapsedSeconds))
                    .font(.system(size: Tokens.FontSize.xs, design: .monospaced))
                    .foregroundStyle(Tokens.Colors.warmTextLight)
            }

            Spacer()

            // Mark moment button
            ZStack(alignment: .top) {
                Button {
                    // TODO: send bookmark event
                    showMarkedToast = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        showMarkedToast = false
                    }
                } label: {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 18))
                        .foregroundStyle(Tokens.Colors.warmTextLight)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Mark this moment")

                if showMarkedToast {
                    Text("Moment marked")
                        .font(.system(size: 10))
                        .foregroundStyle(Tokens.Colors.warmText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(.white.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.md))
                        .shadow(radius: 2)
                        .offset(y: -30)
                        .transition(.opacity)
                }
            }

            Spacer()

            // End session button
            Button {
                appState.endSession()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 10))
                    Text("End")
                        .font(.system(size: Tokens.FontSize.sm, weight: .semibold))
                }
                .foregroundStyle(Tokens.Colors.warmTextLight)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Stop session")
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
        )
        .onAppear { startTimer() }
        .onDisappear { stopTimer() }
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

    private func formatDuration(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}

/// Animated listening dots — mirrors ListeningDots in BottomBar.tsx.
struct ListeningDots: View {
    @State private var animating = false

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Tokens.Colors.warmText)
                    .frame(width: 4, height: 4)
                    .opacity(animating ? 1 : 0.3)
                    .animation(
                        .easeInOut(duration: 0.6)
                            .repeatForever(autoreverses: true)
                            .delay(Double(i) * 0.2),
                        value: animating
                    )
            }
        }
        .onAppear { animating = true }
    }
}
