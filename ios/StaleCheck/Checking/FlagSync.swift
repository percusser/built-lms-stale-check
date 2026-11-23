import FirebaseCore
import FirebaseFirestore
import Foundation

enum FlagSync {
    static var isConfigured: Bool { FirebaseApp.app() != nil }

    static func save(_ flagged: [FlaggedFact], item: SharedItem, courseId: String) async -> Bool {
        guard isConfigured, !flagged.isEmpty else { return false }
        let flags = Firestore.firestore().collection("flags")
        let label = switch item.kind {
        case .image: "Screenshot shared from an iPhone"
        case .url: "Link shared from an iPhone"
        case .text: item.sourceApp.map { "Message from \($0), shared from an iPhone" } ?? "Message shared from an iPhone"
        }
        for flag in flagged {
            let ref = flags.document("\(flag.fact.id):iphone:\(item.id.uuidString.lowercased().prefix(12))")
            do {
                if try await ref.getDocument().exists { continue }
            } catch let error as NSError where error.domain == FirestoreErrorDomain && error.code == FirestoreErrorCode.permissionDenied.rawValue {
                continue
            } catch {
                return false
            }
            var data: [String: Any] = [
                "factId": flag.fact.id,
                "moduleId": flag.fact.moduleId,
                "verdict": flag.verdict,
                "oldValue": flag.fact.value,
                "newValue": flag.newValue,
                "quote": String(flag.quote.prefix(1000)),
                "origin": "iphone",
                "inferenceSource": flag.inferenceSource.rawValue,
                "createdAt": Int(Date().timeIntervalSince1970 * 1000),
                "sourceLabel": String(label.prefix(200)),
                "status": "open",
            ]
            if !courseId.isEmpty { data["courseId"] = courseId }
            do {
                try await ref.setData(data)
            } catch {
                return false
            }
        }
        return true
    }
}
