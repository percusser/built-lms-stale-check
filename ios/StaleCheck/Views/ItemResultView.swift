import SwiftUI

struct ItemResultView: View {
    @Environment(AppModel.self) private var model
    let id: UUID

    var body: some View {
        if let item = model.items.first(where: { $0.id == id }) {
            List {
                Section("Shared message") {
                    Text(item.text.isEmpty ? "Reading the screenshot…" : item.text)
                        .textSelection(.enabled)
                    if let source = item.item.sourceApp {
                        LabeledContent("From", value: source)
                    }
                }
                switch item.state {
                case .waiting, .reading, .checking:
                    Section { ProgressView("Checking against your training") }
                case .failed(let message):
                    Section {
                        Label(message, systemImage: "exclamationmark.triangle")
                        Button("Try again") { Task { await model.check(id) } }
                    }
                case .done(let result) where result.flagged.isEmpty:
                    Section {
                        Label("This message does not change anything your training teaches.", systemImage: "checkmark.circle")
                        if !result.candidates.isEmpty {
                            Text("Compared with \(result.candidates.count) related lesson facts.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                case .done(let result):
                    Section("Training that is now wrong") {
                        ForEach(result.flagged) { flag in
                            FlagCard(flag: flag, lessonTitle: model.lessonTitle(for: flag.fact))
                        }
                    }
                    Section {
                        DashboardStatusRow(state: item.dashboard) {
                            Task { await model.sendFlags(id) }
                        }
                    }
                }
            }
            .navigationTitle("Check result")
            .navigationBarTitleDisplayMode(.inline)
        } else {
            ContentUnavailableView("This item was removed", systemImage: "tray")
        }
    }
}

struct FlagCard: View {
    let flag: FlaggedFact
    let lessonTitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VerdictBadge(verdict: flag.verdict)
                SourceBadge(source: flag.inferenceSource)
            }
            Text(lessonTitle).font(.caption).foregroundStyle(.secondary)
            Text(flag.fact.statement).font(.subheadline.weight(.semibold))
            if flag.verdict == "changed" {
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) {
                    GridRow {
                        Text("Lesson says").foregroundStyle(.secondary)
                        Text(flag.fact.value).strikethrough()
                    }
                    GridRow {
                        Text("Message says").foregroundStyle(.secondary)
                        Text(flag.newValue).bold()
                    }
                }
                .font(.subheadline)
            }
            Text(flag.quote)
                .font(.footnote)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 6))
        }
        .padding(.vertical, 4)
    }
}

struct DashboardStatusRow: View {
    let state: AppModel.DashboardState?
    let retry: () -> Void

    var body: some View {
        switch state {
        case .sending:
            ProgressView("Sending to the dashboard")
        case .sent:
            Label("Sent to the dashboard for review.", systemImage: "checkmark.icloud")
        case .failed:
            Label("Could not send to the dashboard.", systemImage: "exclamationmark.icloud")
            Button("Try again", action: retry)
        case nil:
            Text("Saved on this iPhone. This build is not connected to the dashboard.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}
