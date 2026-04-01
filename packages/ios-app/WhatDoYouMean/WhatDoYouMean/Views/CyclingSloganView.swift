import SwiftUI

/// Cycles through slogans with per-character blur + fade animation.
struct CyclingSloganView: View {
    private let slogans = [
        "Hear meaning, not words, live.",
        "Words land differently in every ear. Let's close the gap!",
    ]

    @State private var currentIndex = 0
    @State private var phase: Phase = .entering
    @State private var charProgress: [Double] = []

    private enum Phase { case entering, holding, exiting }

    var body: some View {
        HStack(spacing: 0) {
            let text = slogans[currentIndex % slogans.count]
            ForEach(Array(text.enumerated()), id: \.offset) { i, char in
                Text(String(char))
                    .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                    .foregroundStyle(Tokens.Colors.foreground)
                    .opacity(charProgress.indices.contains(i) ? charProgress[i] : 0)
                    .blur(radius: charProgress.indices.contains(i) ? (1 - charProgress[i]) * 6 : 6)
            }
        }
        .frame(minHeight: 20)
        .onAppear { startCycle() }
    }

    private func startCycle() {
        let text = slogans[currentIndex % slogans.count]
        charProgress = Array(repeating: 0, count: text.count)
        phase = .entering
        animateEnter(count: text.count)
    }

    private func animateEnter(count: Int) {
        for i in 0..<count {
            let delay = Double(i) * 0.02
            withAnimation(.easeOut(duration: 0.4).delay(delay)) {
                if charProgress.indices.contains(i) {
                    charProgress[i] = 1
                }
            }
        }
        // After all chars visible, hold 2s then exit
        let totalEnterTime = Double(count) * 0.02 + 0.4
        DispatchQueue.main.asyncAfter(deadline: .now() + totalEnterTime + 2.0) {
            phase = .exiting
            animateExit(count: count)
        }
    }

    private func animateExit(count: Int) {
        for i in 0..<count {
            let delay = Double(i) * 0.015
            withAnimation(.easeIn(duration: 0.4).delay(delay)) {
                if charProgress.indices.contains(i) {
                    charProgress[i] = 0
                }
            }
        }
        // After exit, switch to next slogan
        let totalExitTime = Double(count) * 0.015 + 0.4
        DispatchQueue.main.asyncAfter(deadline: .now() + totalExitTime + 0.2) {
            currentIndex += 1
            startCycle()
        }
    }
}
