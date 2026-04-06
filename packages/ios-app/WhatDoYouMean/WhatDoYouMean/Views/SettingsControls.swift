import SwiftUI

struct SettingsControls: View {
    @Environment(AppState.self) private var appState
    @Environment(SessionCoordinator.self) private var coordinator
    var variant: Variant = .full

    enum Variant { case full, responseOnly }

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.md) {
            if variant == .full {
                VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                    Text("Language")
                        .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                        .foregroundStyle(Tokens.Colors.warmText)
                    PillTabs(
                        id: "lang",
                        options: [("en", "EN"), ("zh", "中文"), ("zh+en", "Multi")],
                        selected: appState.sttLanguage.rawValue,
                        onSelect: { v in
                            if let l = SttLanguage(rawValue: v) {
                                appState.sttLanguage = l
                                coordinator.sendSettingsUpdate()
                            }
                        }
                    )
                }

                VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                    Text("Audio source")
                        .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                        .foregroundStyle(Tokens.Colors.warmText)
                    PillTabs(
                        id: "audio",
                        options: [("mic", "Mic"), ("system", "Internal"), ("both", "Both")],
                        selected: appState.audioSource.rawValue,
                        disabled: ["system", "both"],
                        onSelect: { v in if let s = AudioSourceMode(rawValue: v) { appState.audioSource = s } }
                    )
                }

                VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                    Text("Processing mode")
                        .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                        .foregroundStyle(Tokens.Colors.warmText)
                    PillTabs(
                        id: "proc",
                        options: [("local", "Local"), ("cloud", "Cloud"), ("fusion", "Fusion")],
                        selected: appState.processingMode.rawValue,
                        disabled: !coordinator.onDeviceAI.isAvailable ? ["local", "fusion"] : [],
                        onSelect: { v in
                            if let m = ProcessingMode(rawValue: v) {
                                appState.processingMode = m
                            }
                        }
                    )
                    if !coordinator.onDeviceAI.isAvailable {
                        Text("Local processing requires Apple Intelligence")
                            .font(Tokens.Fonts.sans(size: 9))
                            .foregroundStyle(Tokens.Colors.warmTextLight)
                    }
                }
            }

            VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                Text("Response recommendation")
                    .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                    .foregroundStyle(Tokens.Colors.warmText)
                PillTabs(
                    id: "resp",
                    options: [("on", "On"), ("off", "Off")],
                    selected: appState.responseEnabled ? "on" : "off",
                    onSelect: { v in
                        appState.responseEnabled = v == "on"
                        coordinator.sendSettingsUpdate()
                    }
                )
            }
        }
    }
}

struct PillTabs: View {
    let id: String
    let options: [(String, String)]
    let selected: String
    var disabled: [String] = []
    let onSelect: (String) -> Void
    @Namespace private var pillNS

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.0) { value, label in
                let isSelected = value == selected
                let isDisabled = disabled.contains(value)
                Button {
                    if !isDisabled {
                        withAnimation(.easeOut(duration: 0.2)) {
                            onSelect(value)
                        }
                    }
                } label: {
                    Text(label)
                        .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                        .foregroundStyle(
                            isDisabled ? Tokens.Colors.warmTextLight.opacity(0.4) :
                            isSelected ? Tokens.Colors.warmTextDark :
                            Tokens.Colors.warmTextLight
                        )
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .frame(minHeight: 36)
                        .background {
                            if isSelected {
                                Capsule()
                                    .fill(Tokens.Colors.background)
                                    .shadow(color: .black.opacity(0.06), radius: 2, y: 1)
                                    .matchedGeometryEffect(id: "\(id)-pill", in: pillNS)
                            }
                        }
                }
                .buttonStyle(.plain)
                .disabled(isDisabled)
            }
        }
        .padding(3)
        .background(Tokens.Colors.warmBg)
        .clipShape(Capsule())
    }
}
