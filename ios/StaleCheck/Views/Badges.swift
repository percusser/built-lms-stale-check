import SwiftUI

struct SourceBadge: View {
    let source: InferenceSource

    var body: some View {
        Label(source.label, systemImage: source.symbol)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(.indigo.opacity(0.12), in: Capsule())
            .foregroundStyle(.indigo)
    }
}

struct VerdictBadge: View {
    let verdict: String

    var body: some View {
        Label(verdict == "removed" ? "Removed" : "Changed", systemImage: verdict == "removed" ? "xmark.circle" : "arrow.triangle.2.circlepath")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(.orange.opacity(0.15), in: Capsule())
            .foregroundStyle(.orange)
    }
}
