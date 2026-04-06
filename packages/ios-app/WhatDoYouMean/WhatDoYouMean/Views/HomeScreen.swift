import SwiftUI

struct HomeScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(SessionCoordinator.self) private var coordinator
    @State private var transitioning = false
    @State private var contentOpacity: Double = 1
    @State private var morphProgress: CGFloat = 0
    @State private var buttonGlobal: CGRect = .zero
    @State private var screenWidth: CGFloat = 402
    @State private var screenMaxY: CGFloat = 840

    // Staggered entrance
    @State private var appeared = false

    private let barH: CGFloat = 84

    var body: some View {
        ZStack {
            Tokens.Colors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                AnimatedOnboardingSVG()
                    .aspectRatio(1408.0 / 768.0, contentMode: .fit)
                    .padding(.horizontal, Tokens.Spacing.md)

                Spacer().frame(height: Tokens.Spacing.lg)

                Text("Ready to interpret for you.")
                    .font(Tokens.Fonts.serif(size: Tokens.FontSize.xl))
                    .foregroundStyle(Tokens.Colors.warmText)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 14)
                    .animation(.easeOut(duration: 0.5).delay(0.25), value: appeared)

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
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 12)
                .animation(.easeOut(duration: 0.5).delay(0.4), value: appeared)

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
                .opacity(appeared ? 1 : 0)
                .animation(.easeOut(duration: 0.4).delay(0.55), value: appeared)

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
                .padding(.bottom, Tokens.Spacing.xl)
                .opacity(appeared ? 1 : 0)
                .animation(.easeOut(duration: 0.4).delay(0.6), value: appeared)
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .opacity(contentOpacity)
            .background(GeometryReader { g in
                Color.clear.onAppear {
                    let f = g.frame(in: .global)
                    screenWidth = f.width
                    screenMaxY = f.maxY
                }
            })
        }
        .onAppear { appeared = true }
        .overlay {
            if transitioning {
                GeometryReader { fullGeo in
                    let t = morphProgress
                    let trueScreenBottom = fullGeo.size.height

                    let startX = buttonGlobal.minX
                    let startY = buttonGlobal.minY
                    let startW = buttonGlobal.width
                    let startH = buttonGlobal.height

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
            coordinator.startSession()
        }
    }

    private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * t
    }
}
