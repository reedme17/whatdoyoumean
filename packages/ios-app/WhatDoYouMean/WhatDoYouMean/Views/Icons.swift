import SwiftUI

/// Custom icons — SVG paths from Mac version's lucide-animated icons.
/// Replaces all SF Symbols usage to match Mac version exactly.

// MARK: - Menu Icon (hamburger — from menu-icon.tsx)

struct MenuIcon: View {
    let size: CGFloat

    init(size: CGFloat = 20) { self.size = size }

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 24
            var path = Path()
            path.move(to: CGPoint(x: 4 * scale, y: 6 * scale))
            path.addLine(to: CGPoint(x: 20 * scale, y: 6 * scale))
            path.move(to: CGPoint(x: 4 * scale, y: 12 * scale))
            path.addLine(to: CGPoint(x: 20 * scale, y: 12 * scale))
            path.move(to: CGPoint(x: 4 * scale, y: 18 * scale))
            path.addLine(to: CGPoint(x: 20 * scale, y: 18 * scale))
            context.stroke(path, with: .color(Tokens.Colors.warmText),
                           style: StrokeStyle(lineWidth: 2 * scale, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - X Icon (close — from x-icon.tsx)

struct XIcon: View {
    let size: CGFloat

    init(size: CGFloat = 20) { self.size = size }

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 24
            var path = Path()
            path.move(to: CGPoint(x: 18 * scale, y: 6 * scale))
            path.addLine(to: CGPoint(x: 6 * scale, y: 18 * scale))
            path.move(to: CGPoint(x: 6 * scale, y: 6 * scale))
            path.addLine(to: CGPoint(x: 18 * scale, y: 18 * scale))
            context.stroke(path, with: .color(Tokens.Colors.warmText),
                           style: StrokeStyle(lineWidth: 2 * scale, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Keyboard Icon (from keyboard-icon.tsx)

struct KeyboardIcon: View {
    let size: CGFloat

    init(size: CGFloat = 20) { self.size = size }

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            // Outer rect
            let rect = CGRect(x: 2 * s, y: 4 * s, width: 20 * s, height: 16 * s)
            let rrect = Path(roundedRect: rect, cornerRadius: 2 * s)
            context.stroke(rrect, with: .color(Tokens.Colors.warmText),
                           style: StrokeStyle(lineWidth: 2 * s, lineCap: .round, lineJoin: .round))
            // Keys (dots)
            let keys: [(CGFloat, CGFloat)] = [
                (6, 8), (10, 8), (14, 8), (18, 8),
                (8, 12), (12, 12), (16, 12)
            ]
            for (x, y) in keys {
                var dot = Path()
                dot.move(to: CGPoint(x: x * s, y: y * s))
                dot.addLine(to: CGPoint(x: x * s + 0.01, y: y * s))
                context.stroke(dot, with: .color(Tokens.Colors.warmText),
                               style: StrokeStyle(lineWidth: 2 * s, lineCap: .round))
            }
            // Space bar
            var space = Path()
            space.move(to: CGPoint(x: 7 * s, y: 16 * s))
            space.addLine(to: CGPoint(x: 17 * s, y: 16 * s))
            context.stroke(space, with: .color(Tokens.Colors.warmText),
                           style: StrokeStyle(lineWidth: 2 * s, lineCap: .round))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - MapPinPlus Icon (mark moment) (mark moment — from map-pin-plus-icon.tsx)

struct MapPinPlusIcon: View {
    let size: CGFloat
    var color: Color = Tokens.Colors.warmText

    init(size: CGFloat = 20, color: Color = Tokens.Colors.warmText) { self.size = size; self.color = color }

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            // Pin outline
            var pin = Path()
            pin.addArc(center: CGPoint(x: 12 * s, y: 10 * s), radius: 8 * s,
                       startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
            pin.addQuadCurve(to: CGPoint(x: 12 * s, y: 22 * s),
                             control: CGPoint(x: 20 * s, y: 16 * s))
            pin.addQuadCurve(to: CGPoint(x: 4 * s, y: 10 * s),
                             control: CGPoint(x: 4 * s, y: 16 * s))
            context.stroke(pin, with: .color(color),
                           style: StrokeStyle(lineWidth: 2 * s, lineCap: .round, lineJoin: .round))
            // Plus
            var plus = Path()
            plus.move(to: CGPoint(x: 12 * s, y: 7 * s))
            plus.addLine(to: CGPoint(x: 12 * s, y: 13 * s))
            plus.move(to: CGPoint(x: 9 * s, y: 10 * s))
            plus.addLine(to: CGPoint(x: 15 * s, y: 10 * s))
            context.stroke(plus, with: .color(color),
                           style: StrokeStyle(lineWidth: 2 * s, lineCap: .round))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - SlidersHorizontal Icon (settings — from sliders-icon.tsx)

struct SlidersIcon: View {
    let size: CGFloat
    var color: Color = Tokens.Colors.warmText

    init(size: CGFloat = 18, color: Color = Tokens.Colors.warmText) { self.size = size; self.color = color }

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            let style = StrokeStyle(lineWidth: 2 * s, lineCap: .round)
            // Top line
            var p = Path()
            p.move(to: CGPoint(x: 21 * s, y: 4 * s))
            p.addLine(to: CGPoint(x: 14 * s, y: 4 * s))
            p.move(to: CGPoint(x: 10 * s, y: 4 * s))
            p.addLine(to: CGPoint(x: 3 * s, y: 4 * s))
            // Middle line
            p.move(to: CGPoint(x: 21 * s, y: 12 * s))
            p.addLine(to: CGPoint(x: 12 * s, y: 12 * s))
            p.move(to: CGPoint(x: 8 * s, y: 12 * s))
            p.addLine(to: CGPoint(x: 3 * s, y: 12 * s))
            // Bottom line
            p.move(to: CGPoint(x: 3 * s, y: 20 * s))
            p.addLine(to: CGPoint(x: 12 * s, y: 20 * s))
            p.move(to: CGPoint(x: 16 * s, y: 20 * s))
            p.addLine(to: CGPoint(x: 21 * s, y: 20 * s))
            context.stroke(p, with: .color(color), style: style)
            // Knobs (vertical bars)
            var knobs = Path()
            knobs.move(to: CGPoint(x: 14 * s, y: 2 * s))
            knobs.addLine(to: CGPoint(x: 14 * s, y: 6 * s))
            knobs.move(to: CGPoint(x: 8 * s, y: 10 * s))
            knobs.addLine(to: CGPoint(x: 8 * s, y: 14 * s))
            knobs.move(to: CGPoint(x: 16 * s, y: 18 * s))
            knobs.addLine(to: CGPoint(x: 16 * s, y: 22 * s))
            context.stroke(knobs, with: .color(color), style: style)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Chevron Icon (expandable — from chevron-icon.tsx)

struct ChevronLeftIcon: View {
    let size: CGFloat
    var expanded: Bool = false

    init(size: CGFloat = 14, expanded: Bool = false) {
        self.size = size
        self.expanded = expanded
    }

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            var path = Path()
            path.move(to: CGPoint(x: 15 * s, y: 18 * s))
            path.addLine(to: CGPoint(x: 9 * s, y: 12 * s))
            path.addLine(to: CGPoint(x: 15 * s, y: 6 * s))
            context.stroke(path, with: .color(Tokens.Colors.warmText),
                           style: StrokeStyle(lineWidth: 2 * s, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(expanded ? -90 : 0))
        .animation(.easeOut(duration: 0.25), value: expanded)
    }
}

// MARK: - ChevronDown Icon (scroll indicator — from chevron-down-icon.tsx)

struct ChevronDownIcon: View {
    let size: CGFloat

    init(size: CGFloat = 18) { self.size = size }

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            var path = Path()
            path.move(to: CGPoint(x: 6 * s, y: 9 * s))
            path.addLine(to: CGPoint(x: 12 * s, y: 15 * s))
            path.addLine(to: CGPoint(x: 18 * s, y: 9 * s))
            context.stroke(path, with: .color(Tokens.Colors.warmText),
                           style: StrokeStyle(lineWidth: 2 * s, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Square Icon (stop — used in BottomBar End button)

struct SquareIcon: View {
    let size: CGFloat
    var color: Color = Tokens.Colors.warmText

    init(size: CGFloat = 12, color: Color = Tokens.Colors.warmText) { self.size = size; self.color = color }

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 1))
    }
}

// MARK: - Feather Icon (from feather-icon.tsx)

struct FeatherIcon: View {
    let size: CGFloat

    init(size: CGFloat = 20) { self.size = size }

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            let style = StrokeStyle(lineWidth: 2 * s, lineCap: .round, lineJoin: .round)
            // Feather body
            var body = Path()
            body.move(to: CGPoint(x: 12.67 * s, y: 19 * s))
            body.addCurve(to: CGPoint(x: 17.83 * s, y: 9.75 * s),
                          control1: CGPoint(x: 14 * s, y: 19 * s),
                          control2: CGPoint(x: 17.83 * s, y: 14 * s))
            body.addCurve(to: CGPoint(x: 5.59 * s, y: 9.91 * s),
                          control1: CGPoint(x: 17.83 * s, y: 5 * s),
                          control2: CGPoint(x: 5.59 * s, y: 5 * s))
            body.addLine(to: CGPoint(x: 5 * s, y: 11.33 * s))
            body.addLine(to: CGPoint(x: 5 * s, y: 18 * s))
            body.addLine(to: CGPoint(x: 6 * s, y: 19 * s))
            body.closeSubpath()
            context.stroke(body, with: .color(Tokens.Colors.warmText), style: style)
            // Pen line
            var pen = Path()
            pen.move(to: CGPoint(x: 16 * s, y: 8 * s))
            pen.addLine(to: CGPoint(x: 2 * s, y: 22 * s))
            context.stroke(pen, with: .color(Tokens.Colors.warmText), style: style)
            // Cross line
            var cross = Path()
            cross.move(to: CGPoint(x: 17.5 * s, y: 15 * s))
            cross.addLine(to: CGPoint(x: 9 * s, y: 15 * s))
            context.stroke(cross, with: .color(Tokens.Colors.warmText), style: style)
        }
        .frame(width: size, height: size)
    }
}
