import SwiftUI

struct OnboardingScreen: View {
    @State private var appeared = false
    @State private var transitioning = false
    @State private var circleScale: CGFloat = 0
    @State private var buttonCenter: CGPoint = .zero
    var onEnter: () -> Void

    var body: some View {
        ZStack {
            Tokens.Colors.background
                .ignoresSafeArea()

            VStack(spacing: Tokens.Spacing.xxl) {
                Spacer()

                Image("onboarding")
                    .resizable()
                    .renderingMode(.original)
                    .aspectRatio(contentMode: .fit)

                Text("Hear meaning, not words, live.")
                    .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                    .foregroundStyle(Tokens.Colors.foreground)

                // Enter button with position tracking
                Button {
                    guard !transitioning else { return }
                    transitioning = true
                    withAnimation(.easeIn(duration: 1.0)) {
                        circleScale = 4
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        onEnter()
                    }
                } label: {
                    Text("Enter")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .bold))
                        .foregroundStyle(Tokens.Colors.warmTextDark)
                        .padding(.horizontal, Tokens.Spacing.xl)
                        .padding(.vertical, Tokens.Spacing.md)
                        .frame(minHeight: 44)
                        .background(Tokens.Colors.warmBg)
                        .clipShape(Capsule())
                }
                .background(
                    GeometryReader { geo in
                        Color.clear.onAppear {
                            let frame = geo.frame(in: .global)
                            buttonCenter = CGPoint(x: frame.midX, y: frame.midY)
                        }
                    }
                )

                Spacer()
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)

            // Circle expanding from button center
            if transitioning {
                GeometryReader { geo in
                    let maxDim = max(geo.size.width, geo.size.height) * 2
                    Circle()
                        .fill(Tokens.Colors.warmBg)
                        .frame(width: maxDim, height: maxDim)
                        .scaleEffect(circleScale)
                        .position(x: buttonCenter.x, y: buttonCenter.y)
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                appeared = true
            }
        }
    }
}
