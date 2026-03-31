import SwiftUI

struct HomeScreen: View {
    @Environment(AppState.self) private var appState
    @State private var transitioning = false
    @State private var contentOpacity: Double = 1
    @State private var morphProgress: CGFloat = 0
    @State private var buttonGlobal: CGRect = .zero
    @State private var screenWidth: CGFloat = 402
    @State private var screenMaxY: CGFloat = 840

    // BottomBar measured: h=84, bottom-aligned to screen
    private let barH: CGFloat = 84

    var body: some View {
        ZStack {
            Tokens.Colors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                Text("Ready to interpret for you.")
                    .font(Tokens.Fonts.serif(size: Tokens.FontSize.xl))
                    .foregroundStyle(Tokens.Colors.warmText)

                Spacer().frame(height: Tokens.Spacing.xl)

                Button {
                    guard !transitioning else { return }
                    startMorph()
                } label: {
                    Text("Start listening")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .bold))
                        .foregroundStyle(transitioning ? .clear : Tokens.Colors.warmTextDark)
                        .padding(.horizontal, Tokens.Spacing.xl)
                        .padding(.vertical, Tokens.Spacing.md)
                        .frame(minHeight: 44)
                        .background(transitioning ? Color.clear : Tokens.Colors.warmBg)
                        .clipShape(Capsule())
                }
                .background(GeometryReader { g in
                    Color.clear
                        .onAppear { buttonGlobal = g.frame(in: .global) }
                        .onChange(of: g.frame(in: .global)) { _, f in buttonGlobal = f }
                })
                .accessibilityLabel("Start listening session")

                Spacer().frame(height: Tokens.Spacing.md)

                Button {
                    appState.screen = .text
                } label: {
                    KeyboardIcon(size: 24)
                        .allowsHitTesting(false)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Switch to text input mode")

                Spacer()

                HStack {
                    Spacer()
                    Button {
                        appState.showSidePanel = true
                    } label: {
                        MenuIcon(size: 20)
                            .allowsHitTesting(false)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("Open menu")
                }
                .padding(Tokens.Spacing.sm)
            }
            .padding(Tokens.Spacing.sm)
            .opacity(contentOpacity)
            .background(GeometryReader { g in
                Color.clear.onAppear {
                    let f = g.frame(in: .global)
                    screenWidth = f.width
                    screenMaxY = f.maxY
                }
            })
        }
        .overlay {
            // Morph bar in global coordinate overlay (above everything, ignores safe area)
            if transitioning {
                GeometryReader { fullGeo in
                    let t = morphProgress
                    let trueScreenBottom = fullGeo.size.height

                    let startX = buttonGlobal.minX
                    let startY = buttonGlobal.minY
                    let startW = buttonGlobal.width
                    let startH = buttonGlobal.height

                    // End: BottomBar top at y=756, extends to physical screen bottom
                    let endX: CGFloat = 0
                    let endY = screenMaxY - barH
                    let endW = screenWidth
                    let endH = trueScreenBottom - endY

                    let x = lerp(startX, endX, t)
                    let y = lerp(startY, endY, t)
                    let w = lerp(startW, endW, t)
                    let h = lerp(startH, endH, t)
                    let topR = lerp(startH / 2, 16, t)
                    let botR = lerp(startH / 2, 0, t)

                    UnevenRoundedRectangle(
                        topLeadingRadius: topR,
                        bottomLeadingRadius: botR,
                        bottomTrailingRadius: botR,
                        topTrailingRadius: topR
                    )
                    .fill(Tokens.Colors.warmBg)
                    .frame(width: w, height: h)
                    .position(x: x + w / 2, y: y + h / 2)
                }
                .ignoresSafeArea()
            }
        }
    }

    private func startMorph() {
        transitioning = true

        withAnimation(.easeIn(duration: 0.15)) {
            contentOpacity = 0
        }

        withAnimation(.spring(response: 0.6, dampingFraction: 0.82)) {
            morphProgress = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            appState.startSession()
        }
    }

    private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * t
    }
}
