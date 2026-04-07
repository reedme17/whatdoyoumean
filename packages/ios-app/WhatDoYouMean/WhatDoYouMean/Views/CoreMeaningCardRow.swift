import SwiftUI

/// Single card row — mirrors CoreMeaningCardView in CoreMeaningCard.tsx.
/// Category italic 11px + content medium 14px, baseline aligned.
/// Optional mark toggle (map-pin icon) for recap mode.
/// Yellow highlighter animates like Mac's CSS background-size draw/erase.
struct CoreMeaningCardRow: View {
    let card: CoreMeaningCard
    var onToggleMark: ((String) -> Void)? = nil

    @State private var highlightProgress: CGFloat = 0

    private static let highlightColor = Color(red: 1, green: 0.9, blue: 0).opacity(0.28)

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Tokens.Spacing.sm) {
            // Category label — italic 11px
            Text(card.category.label)
                .font(Tokens.Fonts.sans(size: 11, weight: .regular).italic())
                .foregroundStyle(Tokens.Colors.warmText)
                .frame(width: 60, alignment: .leading)

            // Content — medium 14px with animated highlight
            Text(card.content)
                .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .medium))
                .foregroundStyle(Tokens.Colors.warmText)
                .padding(.horizontal, 3)
                .padding(.vertical, 1)
                .background(
                    GeometryReader { geo in
                        Self.highlightColor
                            .frame(width: geo.size.width * highlightProgress)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                )

            // Mark toggle (recap only)
            if let onToggleMark {
                Spacer(minLength: 4)
                Button {
                    handleToggle(onToggleMark)
                } label: {
                    Group {
                        if card.isHighlighted {
                            MapPinMinusIcon(size: 18, color: Tokens.Colors.warmTextLight)
                        } else {
                            MapPinPlusIcon(size: 18, color: Tokens.Colors.warmTextLight)
                        }
                    }
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(card.isHighlighted ? "Remove mark" : "Mark moment")
            }
        }
        .onAppear {
            // Set initial state without animation
            highlightProgress = card.isHighlighted ? 1 : 0
        }
        .onChange(of: card.isHighlighted) { _, newValue in
            // Animate when highlight changes from external source (e.g. live session mark)
            withAnimation(.easeOut(duration: 0.5)) {
                highlightProgress = newValue ? 1 : 0
            }
        }
    }

    private func handleToggle(_ toggle: @escaping (String) -> Void) {
        if card.isHighlighted {
            // Erase animation then toggle
            withAnimation(.easeIn(duration: 0.4)) {
                highlightProgress = 0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                toggle(card.id)
            }
        } else {
            // Toggle first, then draw animation
            toggle(card.id)
            highlightProgress = 0
            withAnimation(.easeOut(duration: 0.5)) {
                highlightProgress = 1
            }
        }
    }
}

// MARK: - MapPinMinus Icon (unmark — pin with minus)

struct MapPinMinusIcon: View {
    let size: CGFloat
    var color: Color = Tokens.Colors.warmText

    init(size: CGFloat = 18, color: Color = Tokens.Colors.warmText) { self.size = size; self.color = color }

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            let style = StrokeStyle(lineWidth: 2 * s, lineCap: .round, lineJoin: .round)
            var pin = Path()
            pin.addArc(center: CGPoint(x: 12 * s, y: 10 * s), radius: 8 * s,
                       startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
            pin.addQuadCurve(to: CGPoint(x: 12 * s, y: 22 * s),
                             control: CGPoint(x: 20 * s, y: 16 * s))
            pin.addQuadCurve(to: CGPoint(x: 4 * s, y: 10 * s),
                             control: CGPoint(x: 4 * s, y: 16 * s))
            context.stroke(pin, with: .color(color), style: style)
            var minus = Path()
            minus.move(to: CGPoint(x: 9 * s, y: 10 * s))
            minus.addLine(to: CGPoint(x: 15 * s, y: 10 * s))
            context.stroke(minus, with: .color(color), style: style)
        }
        .frame(width: size, height: size)
    }
}
