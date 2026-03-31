import SwiftUI

/// Single card row — mirrors CoreMeaningCardView in CoreMeaningCard.tsx.
/// Category italic 11px + content medium 14px, baseline aligned.
struct CoreMeaningCardRow: View {
    let card: CoreMeaningCard

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Tokens.Spacing.sm) {
            // Category label — italic 11px
            Text(card.category.label)
                .font(.system(size: 11).italic())
                .foregroundStyle(Tokens.Colors.warmText)
                .frame(width: 48, alignment: .leading)

            // Content — medium 14px
            Text(card.content)
                .font(.system(size: Tokens.FontSize.sm, weight: .medium))
                .foregroundStyle(Tokens.Colors.warmText)
                .background(
                    card.isHighlighted
                        ? Tokens.Colors.warmBg.opacity(0.5)
                        : Color.clear
                )
        }
    }
}
