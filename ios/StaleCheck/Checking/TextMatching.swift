import Foundation

enum TextMatching {
    static let stopwords: Set<String> = Set("a an and are as at be by for from has have in is it of on or that the this to was we will with you your our now".split(separator: " ").map(String.init))

    static func normalize(_ text: String) -> String {
        text.precomposedStringWithCompatibilityMapping
            .replacingOccurrences(of: "[‘’]", with: "'", options: .regularExpression)
            .replacingOccurrences(of: "[“”]", with: "\"", options: .regularExpression)
            .replacingOccurrences(of: "[–—]", with: "-", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    static func tokenize(_ text: String) -> [String] {
        normalize(text)
            .split(whereSeparator: { !($0.isLetter || $0.isNumber || $0 == "$") })
            .map(String.init)
            .filter { $0.count > 1 && !stopwords.contains($0) }
    }

    static func verifyQuote(_ quote: String, in source: String) -> Bool {
        let q = normalize(quote)
        return !q.isEmpty && normalize(source).contains(q)
    }

    static func prefilter(message: String, facts: [Fact], limit: Int = 15) -> [Fact] {
        let words = Set(tokenize(message))
        return facts
            .map { fact -> (Fact, Int) in
                let keywordHits = fact.keywords.filter { tokenize($0).allSatisfy(words.contains) }.count
                let statementHits = tokenize("\(fact.statement) \(fact.value)").filter(words.contains).count
                return (fact, keywordHits * 3 + statementHits)
            }
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
            .prefix(limit)
            .map(\.0)
    }
}
