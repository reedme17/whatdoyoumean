import SwiftUI

struct SidePanel: View {
    @Environment(AppState.self) private var appState
    @Binding var isPresented: Bool
    @State private var activeSection: Section = .none
    @State private var panelView: PanelView = .menu

    enum Section { case none, settings, about }
    enum PanelView { case menu, history }

    var body: some View {
        Group {
            switch panelView {
            case .menu: menuView
            case .history: historyView
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Menu

    private var menuView: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
            sidebarButton("History") {
                isPresented = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    appState.screen = .history
                }
            }

            sidebarButton("Settings", chevron: true, expanded: activeSection == .settings) {
                withAnimation(.easeOut(duration: 0.25)) {
                    activeSection = activeSection == .settings ? .none : .settings
                }
            }
            AccordionContent(expanded: activeSection == .settings) {
                settingsContent
                    .padding(.horizontal, Tokens.Spacing.md)
                    .padding(.vertical, Tokens.Spacing.sm)
            }

            sidebarButton("About", chevron: true, expanded: activeSection == .about) {
                withAnimation(.easeOut(duration: 0.25)) {
                    activeSection = activeSection == .about ? .none : .about
                }
            }
            AccordionContent(expanded: activeSection == .about) {
                aboutContent
                    .padding(.horizontal, Tokens.Spacing.md)
                    .padding(.vertical, Tokens.Spacing.sm)
            }

            sidebarButton("View onboarding") {
                isPresented = false
                // Delay to let sheet dismiss animation finish, then go to onboarding
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    appState.requestOnboarding = true
                }
            }

        }
        .padding(.horizontal, Tokens.Spacing.sm)
        .padding(.top, Tokens.Spacing.xxl)
        .padding(.bottom, Tokens.Spacing.xl)
    }

    // MARK: - History

    private var historyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button {
                    withAnimation { panelView = .menu }
                } label: {
                    ChevronLeftIcon(size: 16)
                        .allowsHitTesting(false)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                Spacer()
            }
            .padding(.horizontal, Tokens.Spacing.sm)

            Text("History")
                .font(Tokens.Fonts.serif(size: Tokens.FontSize.xl))
                .foregroundStyle(Tokens.Colors.warmText)
                .padding(.horizontal, Tokens.Spacing.xl)
                .padding(.bottom, Tokens.Spacing.md)

            Divider()

            if appState.sessionHistory.isEmpty {
                VStack(spacing: Tokens.Spacing.md) {
                    Image(systemName: "clock")
                        .font(.system(size: 32))
                        .foregroundStyle(Tokens.Colors.warmTextLight)
                    Text("No sessions yet")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                        .foregroundStyle(Tokens.Colors.warmTextLight)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Tokens.Spacing.xxxl)
            } else {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(appState.sessionHistory) { session in
                        sessionRow(session)
                    }
                }
                .padding(.horizontal, Tokens.Spacing.sm)
            }
        }
    }

    // MARK: - Settings (shared component)

    private var settingsContent: some View {
        SettingsControls(variant: .full)
    }

    // MARK: - About

    private var aboutContent: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("啥意思")
                .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                .foregroundStyle(Tokens.Colors.warmText)
            Text("What Do You Mean")
                .font(Tokens.Fonts.sans(size: 11))
                .foregroundStyle(Tokens.Colors.muted)
            Text("v0.1.0")
                .font(Tokens.Fonts.sans(size: Tokens.FontSize.xs))
                .foregroundStyle(Tokens.Colors.muted)
        }
    }

    // MARK: - SidebarButton

    private func sidebarButton(_ title: String, chevron: Bool = false, expanded: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .semibold))
                    .foregroundStyle(Tokens.Colors.warmText)
                Spacer()
                if chevron {
                    ChevronLeftIcon(size: 14, expanded: expanded)
                        .allowsHitTesting(false)
                }
            }
            .padding(.horizontal, Tokens.Spacing.md)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Pill Tabs (now in SettingsControls.swift)

    // MARK: - Session Row

    private func sessionRow(_ session: SessionHistoryItem) -> some View {
        Button {
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(session.topicSummary)
                    .font(Tokens.Fonts.sans(size: Tokens.FontSize.xs, weight: .semibold))
                    .foregroundStyle(Tokens.Colors.warmText)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(session.relativeTime)
                    Text("·")
                    Text(session.mode == "online" ? "Audio" : "Text")
                }
                .font(Tokens.Fonts.sans(size: 10))
                .foregroundStyle(Tokens.Colors.warmTextLight)
            }
            .padding(.horizontal, Tokens.Spacing.md)
            .padding(.vertical, Tokens.Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct AccordionContent<Content: View>: View {
    let expanded: Bool
    @ViewBuilder let content: () -> Content
    @State private var contentHeight: CGFloat = 0

    var body: some View {
        VStack(spacing: 0) {
            content()
                .background(
                    GeometryReader { geo in
                        Color.clear
                            .onAppear { contentHeight = geo.size.height }
                            .onChange(of: geo.size.height) { _, h in contentHeight = h }
                    }
                )
        }
        .frame(height: expanded ? contentHeight : 0, alignment: .top)
        .clipped()
        .opacity(expanded ? 1 : 0)
        .animation(.easeOut(duration: 0.25), value: expanded)
    }
}
