import Foundation
import FoundationModels

@Generable
struct GeneratedMatch {
    @Guide(description: "The id of the changed fact, copied from the list")
    let factId: String
    @Guide(description: "The sentence from the message that shows the change, copied exactly")
    let quote: String
    @Guide(description: "The new value in the message's words, or empty when removed")
    let newValue: String
    @Guide(description: "changed or removed", .anyOf(["changed", "removed"]))
    let verdict: String
}

@Generable
struct GeneratedCheck {
    let matches: [GeneratedMatch]
}

struct FoundationModelsChecker: MessageModel {
    let label = "Apple Intelligence on this iPhone"

    func availability() async -> ModelAvailability {
        switch SystemLanguageModel.default.availability {
        case .available: .available
        case .unavailable(.deviceNotEligible): .unavailable("This iPhone cannot run Apple Intelligence.")
        case .unavailable(.appleIntelligenceNotEnabled): .unavailable("Apple Intelligence is turned off in Settings.")
        case .unavailable(.modelNotReady): .unavailable("The on-device model is still downloading.")
        case .unavailable: .unavailable("The on-device model is not available.")
        }
    }

    func check(prompt: String) async throws -> ModelOutput {
        guard case .available = await availability() else { throw CheckFailure.modelUnavailable(label) }
        let parts = prompt.components(separatedBy: "<message>")
        let session = LanguageModelSession(instructions: parts[0])
        let request = parts.count > 1 ? "<message>" + parts.dropFirst().joined(separator: "<message>") : prompt
        do {
            let response = try await session.respond(to: request, generating: GeneratedCheck.self)
            let matches = response.content.matches.map { ModelMatch(factId: $0.factId, quote: $0.quote, newValue: $0.newValue, verdict: $0.verdict) }
            return ModelOutput(matches: matches, inferenceSource: .onDevice)
        } catch let error as LanguageModelSession.GenerationError {
            if case .exceededContextWindowSize = error { throw CheckFailure.tooLong }
            if case .guardrailViolation = error { throw CheckFailure.refused }
            if case .refusal = error { throw CheckFailure.refused }
            throw CheckFailure.modelError(String(describing: error))
        } catch let failure as CheckFailure {
            throw failure
        } catch {
            if #available(iOS 27.0, *), let error = error as? LanguageModelError {
                switch error {
                case .guardrailViolation, .refusal: throw CheckFailure.refused
                case .contextSizeExceeded: throw CheckFailure.tooLong
                default: throw CheckFailure.modelError(error.localizedDescription)
                }
            }
            let text = "\(String(describing: error)) \(error.localizedDescription)".lowercased()
            if ["guardrail", "unsafe", "refus"].contains(where: text.contains) { throw CheckFailure.refused }
            throw CheckFailure.modelError(error.localizedDescription)
        }
    }
}
