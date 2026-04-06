import SwiftUI

/// Smooth organic waveform — mirrors Waveform.tsx "wave" mode.
/// Optimized: 40 points, 30fps, large spatial smoothing window.
struct WaveformView: View {
    let samples: [Float]
    let isCapturing: Bool
    var color: Color = Tokens.Colors.warmBg
    var height: CGFloat = 60

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { _ in
            WaveformShape(points: WaveformState.shared.tick())
                .fill(color)
        }
        .frame(height: height)
        .onChange(of: samples) { _, newSamples in
            WaveformState.shared.feed(newSamples)
        }
    }
}

/// Shape is cheaper than Canvas for simple filled paths.
private struct WaveformShape: Shape {
    let points: [Float]

    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        let count = points.count
        guard count > 1 else { return Path() }

        var path = Path()
        path.move(to: CGPoint(x: 0, y: h))

        for i in 0..<count {
            let t = CGFloat(i) / CGFloat(count - 1)
            let x = t * w

            let fade: CGFloat
            if t >= 0.25 && t <= 0.75 { fade = 1 }
            else if t < 0.25 { fade = 0.5 * (1 - cos(.pi * t / 0.25)) }
            else { fade = 0.5 * (1 - cos(.pi * (1 - t) / 0.25)) }

            let amp = CGFloat(points[i]) * h * 5.0 * fade
            let y = h - min(amp, h - 1)

            if i == 0 {
                path.addLine(to: CGPoint(x: x, y: y))
            } else {
                let prevT = CGFloat(i - 1) / CGFloat(count - 1)
                let cpX = (prevT * w + x) / 2
                let prevFade: CGFloat
                if prevT >= 0.25 && prevT <= 0.75 { prevFade = 1 }
                else if prevT < 0.25 { prevFade = 0.5 * (1 - cos(.pi * prevT / 0.25)) }
                else { prevFade = 0.5 * (1 - cos(.pi * (1 - prevT) / 0.25)) }
                let prevAmp = CGFloat(points[i - 1]) * h * 5.0 * prevFade
                let prevY = h - min(prevAmp, h - 1)
                path.addCurve(
                    to: CGPoint(x: x, y: y),
                    control1: CGPoint(x: cpX, y: prevY),
                    control2: CGPoint(x: cpX, y: y)
                )
            }
        }

        path.addLine(to: CGPoint(x: w, y: h))
        path.closeSubpath()
        return path
    }
}

/// Shared EMA state — downsamples 128 input to 40 output points.
private class WaveformState {
    static let shared = WaveformState()

    private let inputCount = 128
    private let outputCount = 40
    private var emaBuffer: [Float]
    private var latestSamples: [Float]
    private let alpha: Float = 0.06

    init() {
        emaBuffer = Array(repeating: 0, count: outputCount)
        latestSamples = Array(repeating: 0, count: outputCount)
    }

    func feed(_ samples: [Float]) {
        // Downsample 128 → 40 by averaging bins
        let binSize = max(1, samples.count / outputCount)
        for i in 0..<outputCount {
            let start = i * binSize
            let end = min(start + binSize, samples.count)
            guard start < end else { continue }
            var sum: Float = 0
            for j in start..<end { sum += samples[j] }
            latestSamples[i] = sum / Float(end - start)
        }
    }

    func tick() -> [Float] {
        // EMA blend
        for i in 0..<outputCount {
            emaBuffer[i] = emaBuffer[i] * (1 - alpha) + latestSamples[i] * alpha
        }
        // Two-pass spatial smooth (window 11 each) for extra smoothness
        var pass1 = [Float](repeating: 0, count: outputCount)
        for i in 0..<outputCount {
            var sum: Float = 0; var c: Float = 0
            for j in max(0, i - 5)...min(outputCount - 1, i + 5) {
                sum += emaBuffer[j]; c += 1
            }
            pass1[i] = sum / c
        }
        var pass2 = [Float](repeating: 0, count: outputCount)
        for i in 0..<outputCount {
            var sum: Float = 0; var c: Float = 0
            for j in max(0, i - 5)...min(outputCount - 1, i + 5) {
                sum += pass1[j]; c += 1
            }
            pass2[i] = sum / c
        }
        return pass2
    }
}
