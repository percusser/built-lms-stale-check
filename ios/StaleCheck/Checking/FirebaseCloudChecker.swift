import FirebaseAILogic
import FirebaseCore
import Foundation

struct FirebaseCloudChecker: MessageModel {
    static let modelName = "gemini-3.5-flash-lite"
    static let maxMessageCharacters = 40000

    let label = "Gemini in the cloud"
    let source: InferenceSource

    static var isConfigured: Bool { FirebaseApp.app() != nil }

    private static let schema = Schema.object(properties: [
        "matches": .array(items: .object(properties: [
            "factId": .string(),
            "quote": .string(),
            "newValue": .string(),
            "verdict": .enumeration(values: ["changed", "removed"]),
        ])),
    ])

    func availability() async -> ModelAvailability {
        Self.isConfigured ? .available : .unavailable("The cloud model is not set up in this build.")
    }

    func check(prompt: String) async throws -> ModelOutput {
        guard Self.isConfigured else { throw CheckFailure.modelUnavailable(label) }
        let model = FirebaseAI.firebaseAI(backend: .googleAI(), useLimitedUseAppCheckTokens: true).generativeModel(
            modelName: Self.modelName,
            generationConfig: GenerationConfig(responseMIMEType: "application/json", responseSchema: Self.schema)
        )
        do {
            let response = try await model.generateContent(prompt)
            guard let data = response.text?.data(using: .utf8) else { throw CheckFailure.modelError("The cloud model returned no answer.") }
            let decoded = try JSONDecoder().decode(CloudCheck.self, from: data)
            return ModelOutput(matches: decoded.matches, inferenceSource: source)
        } catch let failure as CheckFailure {
            throw failure
        } catch {
            throw CheckFailure.modelError(error.localizedDescription)
        }
    }

    private struct CloudCheck: Decodable {
        let matches: [ModelMatch]
    }
}
