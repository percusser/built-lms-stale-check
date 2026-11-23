import SwiftUI

struct InboxView: View {
    @Environment(AppModel.self) private var model
    @State private var showingPaste = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if model.items.isEmpty {
                        ContentUnavailableView {
                            Label("Nothing shared yet", systemImage: "square.and.arrow.up")
                        } description: {
                            Text("Share a Slack message, an email or a screenshot to Stale Check, and it checks it against your training.")
                        } actions: {
                            Button("Paste a message") { showingPaste = true }
                        }
                    }
                    ForEach(model.items) { item in
                        NavigationLink(value: item.id) {
                            ItemRow(item: item)
                        }
                    }
                    .onDelete { offsets in
                        for i in offsets { model.remove(model.items[i].id) }
                    }
                } header: {
                    Text("Shared with Stale Check")
                }
                Section {
                    NavigationLink {
                        FactsView()
                    } label: {
                        LabeledContent("Lesson facts on this iPhone", value: "\(model.facts.count)")
                    }
                    ModelStatusRow()
                    Button("Recheck all", systemImage: "arrow.clockwise") {
                        Task { await model.recheckAll() }
                    }
                    .disabled(model.items.isEmpty)
                } footer: {
                    Text("Version \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""))")
                }
            }
            .navigationTitle("Stale Check")
            .navigationDestination(for: UUID.self) { id in
                ItemResultView(id: id)
            }
            .toolbar {
                Button("Paste", systemImage: "doc.on.clipboard") { showingPaste = true }
            }
            .sheet(isPresented: $showingPaste) {
                PasteSheet()
            }
            .refreshable { await model.refresh() }
        }
    }
}

struct ItemRow: View {
    let item: AppModel.CheckedItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.text.isEmpty ? "Screenshot" : item.text)
                .lineLimit(2)
            HStack(spacing: 6) {
                status
                Text(sharedLabel)
                    .foregroundStyle(.secondary)
            }
            .font(.caption)
        }
    }

    private var sharedLabel: String {
        let date = item.item.sharedAt
        if Calendar.current.isDateInToday(date) {
            return "Shared \(date.formatted(date: .omitted, time: .shortened))"
        }
        return "Shared \(date.formatted(.dateTime.month(.abbreviated).day().hour().minute()))"
    }

    @ViewBuilder private var status: some View {
        switch item.state {
        case .waiting: Label("Waiting", systemImage: "clock")
        case .reading: Label("Reading the screenshot", systemImage: "text.viewfinder")
        case .checking: Label("Checking", systemImage: "hourglass")
        case .failed: Label("Not checked", systemImage: "exclamationmark.triangle")
        case .done(let result):
            if result.flagged.isEmpty {
                Label("No training affected", systemImage: "checkmark.circle")
            } else {
                Label("\(result.flagged.count) lesson fact\(result.flagged.count == 1 ? "" : "s") changed", systemImage: "exclamationmark.circle.fill")
                    .foregroundStyle(.orange)
            }
        }
    }
}

struct ModelStatusRow: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.availability {
        case .available:
            Label("\(model.model.label) is ready. Checks run on this iPhone.", systemImage: "iphone")
                .font(.footnote)
        case .unavailable(let reason):
            Label("\(reason) The cloud model is not connected yet.", systemImage: "iphone.slash")
                .font(.footnote)
                .foregroundStyle(.secondary)
        case nil:
            ProgressView()
        }
    }
}

struct PasteSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""

    var body: some View {
        NavigationStack {
            TextEditor(text: $text)
                .padding()
                .navigationTitle("Check a message")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Check") {
                            let message = text
                            dismiss()
                            Task { await model.add(message: message) }
                        }
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
        }
    }
}
