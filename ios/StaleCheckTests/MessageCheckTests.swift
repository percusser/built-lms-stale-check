import XCTest
@testable import Stale_Check

private struct Sample: Decodable {
    struct Message: Decodable {
        struct Expect: Decodable { let factId: String; let verdict: String }
        let id: String
        let text: String
        let expect: [Expect]
    }
    let messages: [Message]
}

private struct ScriptedModel: MessageModel {
    let label = "Scripted"
    let matches: [ModelMatch]
    func availability() async -> ModelAvailability { .available }
    func check(prompt: String) async throws -> ModelOutput { ModelOutput(matches: matches, inferenceSource: .onDevice) }
}

final class MessageCheckTests: XCTestCase {
    private let facts = FactStore.bundled().facts

    private func samples() throws -> [Sample.Message] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "messages", withExtension: "json"))
        return try JSONDecoder().decode(Sample.self, from: Data(contentsOf: url)).messages
    }

    func testEveryChangingMessageKeepsItsFactInThePrefilter() throws {
        XCTAssertEqual(facts.count, 15)
        for message in try samples() {
            let candidates = Set(TextMatching.prefilter(message: message.text, facts: facts).map(\.id))
            for expected in message.expect {
                XCTAssertTrue(candidates.contains(expected.factId), "\(message.id) lost \(expected.factId)")
            }
        }
    }

    func testUnrelatedMessageSkipsTheModel() throws {
        let message = try XCTUnwrap(samples().first { $0.id == "m-unrelated" })
        XCTAssertTrue(TextMatching.prefilter(message: message.text, facts: facts).isEmpty)
    }

    func testMatchWithInventedQuoteIsRejected() async throws {
        let text = "Ops update: managers now only need to approve refunds over $1,000."
        let model = ScriptedModel(matches: [
            ModelMatch(factId: "f-refund-manager-approval", quote: "Managers approve refunds over $2,000.", newValue: "over $2,000", verdict: "changed"),
        ])
        let result = try await MessageCheck.run(message: text, facts: facts, template: "{{facts}}\n{{message}}", model: model)
        XCTAssertTrue(result.flagged.isEmpty)
        XCTAssertEqual(result.rejected.count, 1)
    }

    func testMatchForFactOutsideTheCandidatesIsRejected() async throws {
        let text = "Ops update: managers now only need to approve refunds over $1,000."
        let model = ScriptedModel(matches: [
            ModelMatch(factId: "f-exchange-once", quote: text, newValue: "twice", verdict: "changed"),
            ModelMatch(factId: "f-refund-manager-approval", quote: text, newValue: "over $1,000", verdict: "changed"),
        ])
        let result = try await MessageCheck.run(message: text, facts: facts, template: "{{facts}}\n{{message}}", model: model)
        XCTAssertEqual(result.flagged.map(\.fact.id), ["f-refund-manager-approval"])
    }
}
