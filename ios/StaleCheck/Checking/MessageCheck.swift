import Foundation

enum InferenceSource: String, Codable {
    case onDevice = "ON_DEVICE"
    case inCloud = "IN_CLOUD"
    case inCloudAfterRefusal = "IN_CLOUD_AFTER_REFUSAL"

    var label: String {
        switch self {
        case .onDevice: "On device"
        case .inCloud: "Cloud"
        case .inCloudAfterRefusal: "Cloud (on-device refused)"
        }
    }

    var symbol: String { self == .onDevice ? "iphone" : "cloud" }
}

struct ModelMatch: Codable, Hashable {
    let factId: String
    let quote: String
    let newValue: String
    let verdict: String
}

struct ModelOutput {
    let matches: [ModelMatch]
    let inferenceSource: InferenceSource
}

enum CheckFailure: Error, Equatable {
    case modelUnavailable(String)
    case tooLong
    case modelError(String)
    case refused
}

protocol MessageModel: Sendable {
    var label: String { get }
    func availability() async -> ModelAvailability
    func check(prompt: String) async throws -> ModelOutput
}

enum ModelAvailability: Equatable {
    case available
    case unavailable(String)
}

struct FlaggedFact: Identifiable, Hashable {
    var id: String { fact.id }
    let fact: Fact
    let verdict: String
    let newValue: String
    let quote: String
    let inferenceSource: InferenceSource
}

struct CheckResult {
    let flagged: [FlaggedFact]
    let rejected: [ModelMatch]
    let candidates: [Fact]
    var source: InferenceSource?
}

enum MessageCheck {
    static let maxMessageCharacters = 6000

    static func prompt(template: String, facts: [Fact], message: String) -> String {
        template
            .replacingOccurrences(of: "{{facts}}", with: facts.map { "[\($0.id)] \($0.statement)" }.joined(separator: "\n"))
            .replacingOccurrences(of: "{{message}}", with: message)
    }

    static func accept(_ output: ModelOutput, candidates: [Fact], message: String) -> CheckResult {
        let byId = Dictionary(uniqueKeysWithValues: candidates.map { ($0.id, $0) })
        var flagged: [FlaggedFact] = []
        var rejected: [ModelMatch] = []
        for match in output.matches {
            guard let fact = byId[match.factId],
                  ["changed", "removed"].contains(match.verdict),
                  TextMatching.verifyQuote(match.quote, in: message),
                  match.verdict == "removed" || (!match.newValue.isEmpty && TextMatching.normalize(match.newValue) != TextMatching.normalize(fact.value)),
                  !flagged.contains(where: { $0.fact.id == fact.id })
            else {
                rejected.append(match)
                continue
            }
            flagged.append(FlaggedFact(fact: fact, verdict: match.verdict, newValue: match.newValue, quote: match.quote, inferenceSource: output.inferenceSource))
        }
        return CheckResult(flagged: flagged, rejected: rejected, candidates: candidates, source: output.inferenceSource)
    }

    static func run(message: String, facts: [Fact], template: String, model: MessageModel, maxCharacters: Int = maxMessageCharacters) async throws -> CheckResult {
        guard message.count <= maxCharacters else { throw CheckFailure.tooLong }
        let candidates = TextMatching.prefilter(message: message, facts: facts)
        guard !candidates.isEmpty else { return CheckResult(flagged: [], rejected: [], candidates: []) }
        let output = try await model.check(prompt: prompt(template: template, facts: candidates, message: message))
        return accept(output, candidates: candidates, message: message)
    }

    static func bundledTemplate() -> String {
        Bundle.main.url(forResource: "check-message", withExtension: "md").flatMap { try? String(contentsOf: $0, encoding: .utf8) } ?? ""
    }
}
