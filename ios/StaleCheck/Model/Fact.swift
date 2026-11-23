import Foundation

struct Fact: Codable, Identifiable, Hashable {
    let id: String
    let moduleId: String
    let blockId: String
    let statement: String
    let value: String
    let sourceUrl: String
    let quizQuestionIds: [String]
    let keywords: [String]
}

struct FactBundle: Codable {
    let courseId: String
    let facts: [Fact]
}

enum FactStore {
    static func bundled() -> FactBundle {
        guard let url = Bundle.main.url(forResource: "facts.golden", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let bundle = try? JSONDecoder().decode(FactBundle.self, from: data)
        else { return FactBundle(courseId: "", facts: []) }
        return bundle
    }
}

struct CourseOutline: Codable {
    struct Module: Codable { let id: String; let title: String }
    let id: String
    let title: String
    let modules: [Module]

    static func bundled() -> CourseOutline? {
        Bundle.main.url(forResource: "course", withExtension: "json")
            .flatMap { try? Data(contentsOf: $0) }
            .flatMap { try? JSONDecoder().decode(CourseOutline.self, from: $0) }
    }

    func lessonTitle(_ moduleId: String) -> String {
        modules.first { $0.id == moduleId }?.title ?? ""
    }
}
