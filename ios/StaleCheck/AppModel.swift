import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    enum ItemState {
        case waiting
        case reading
        case checking
        case done(CheckResult)
        case failed(String)
    }

    enum DashboardState {
        case sending
        case sent
        case failed
    }

    struct CheckedItem: Identifiable {
        let item: SharedItem
        var text: String
        var state: ItemState
        var dashboard: DashboardState?
        var id: UUID { item.id }
    }

    let facts: [Fact]
    let courseId: String
    let course: CourseOutline?
    let model: MessageModel
    private let template = MessageCheck.bundledTemplate()
    var availability: ModelAvailability?
    var items: [CheckedItem] = []

    init(model: MessageModel = FoundationModelsChecker()) {
        let bundle = FactStore.bundled()
        facts = bundle.facts
        courseId = bundle.courseId
        course = CourseOutline.bundled()
        self.model = model
    }

    func refresh() async {
        availability = await model.availability()
        for item in SharedInbox.pending() where !items.contains(where: { $0.id == item.id }) {
            items.insert(CheckedItem(item: item, text: item.text ?? "", state: .waiting), at: 0)
        }
        for checked in items where checked.isWaiting {
            await check(checked.id)
        }
    }

    func recheckAll() async {
        for checked in items { await check(checked.id) }
    }

    func add(message: String) async {
        try? SharedInbox.save(text: message, sourceApp: "Pasted")
        await refresh()
    }

    func remove(_ id: UUID) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        SharedInbox.remove(items[index].item)
        items.remove(at: index)
    }

    func check(_ id: UUID) async {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        let item = items[index].item
        do {
            if item.kind == .image {
                set(id, .reading)
                guard let data = SharedInbox.imageData(for: item) else { throw CheckFailure.modelError("The shared image is missing.") }
                let text = try await TextRecognizer.text(in: data)
                if let i = items.firstIndex(where: { $0.id == id }) { items[i].text = text }
            }
            set(id, .checking)
            let text = items.first { $0.id == id }?.text ?? ""
            do {
                set(id, .done(try await MessageCheck.run(message: text, facts: facts, template: template, model: model)))
            } catch CheckFailure.refused {
                try await checkInCloud(id, text: text, source: .inCloudAfterRefusal, otherwise: "Apple's on-device model refused this message, and the cloud model is not set up in this build.")
            } catch CheckFailure.tooLong {
                try await checkInCloud(id, text: text, source: .inCloud, otherwise: "This is too long for the on-device model, and the cloud model is not set up in this build.")
            } catch CheckFailure.modelUnavailable {
                try await checkInCloud(id, text: text, source: .inCloud, otherwise: "The on-device model is not available, and the cloud model is not set up in this build.")
            }
        } catch CheckFailure.tooLong {
            set(id, .failed("This message is too long to check."))
        } catch CheckFailure.modelError(let detail) {
            set(id, .failed(detail))
        } catch {
            set(id, .failed(error.localizedDescription))
        }
    }

    private func checkInCloud(_ id: UUID, text: String, source: InferenceSource, otherwise: String) async throws {
        guard FirebaseCloudChecker.isConfigured else {
            set(id, .failed(otherwise))
            return
        }
        let cloud = FirebaseCloudChecker(source: source)
        set(id, .done(try await MessageCheck.run(message: text, facts: facts, template: template, model: cloud, maxCharacters: FirebaseCloudChecker.maxMessageCharacters)))
    }

    func lessonTitle(for fact: Fact) -> String {
        course?.lessonTitle(fact.moduleId) ?? ""
    }

    private func set(_ id: UUID, _ state: ItemState) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        items[index].state = state
        CheckLog.write(id: id, text: items[index].text, state: state)
        items[index].dashboard = nil
        if case .done(let result) = state, !result.flagged.isEmpty {
            Task { await sendFlags(id) }
        }
    }

    func sendFlags(_ id: UUID) async {
        guard FlagSync.isConfigured,
              let index = items.firstIndex(where: { $0.id == id }),
              case .done(let result) = items[index].state, !result.flagged.isEmpty
        else { return }
        items[index].dashboard = .sending
        let sent = await FlagSync.save(result.flagged, item: items[index].item, courseId: courseId)
        if let i = items.firstIndex(where: { $0.id == id }) { items[i].dashboard = sent ? .sent : .failed }
    }
}

enum CheckLog {
    private struct Entry: Encodable {
        let text: String
        let outcome: String
        let flagged: [[String: String]]
    }

    static func write(id: UUID, text: String, state: AppModel.ItemState) {
        let entry: Entry
        switch state {
        case .done(let result):
            entry = Entry(text: text, outcome: result.flagged.isEmpty ? "no_training_affected" : "flagged", flagged: result.flagged.map {
                ["factId": $0.fact.id, "verdict": $0.verdict, "newValue": $0.newValue, "quote": $0.quote, "source": $0.inferenceSource.rawValue]
            })
        case .failed(let message):
            entry = Entry(text: text, outcome: "failed: \(message)", flagged: [])
        default:
            return
        }
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        let dir = docs.appending(path: "Results")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? JSONEncoder().encode(entry).write(to: dir.appending(path: "\(id.uuidString).json"))
    }
}

extension AppModel.CheckedItem {
    var isWaiting: Bool {
        if case .waiting = state { return true }
        return false
    }
}
