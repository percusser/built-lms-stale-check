import Foundation

struct SharedItem: Codable, Identifiable, Hashable {
    enum Kind: String, Codable { case text, image, url }
    let id: UUID
    let kind: Kind
    let text: String?
    let imageFile: String?
    let sourceApp: String?
    let sharedAt: Date
}

enum SharedInbox {
    static let appGroup = "group.com.builtlms.stalecheck"

    static var directory: URL {
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appending(path: "Inbox", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func save(text: String, kind: SharedItem.Kind = .text, sourceApp: String? = nil) throws {
        try write(SharedItem(id: UUID(), kind: kind, text: text, imageFile: nil, sourceApp: sourceApp, sharedAt: .now))
    }

    static func save(imageData: Data, sourceApp: String? = nil) throws {
        let id = UUID()
        let file = "\(id.uuidString).img"
        try imageData.write(to: directory.appending(path: file))
        try write(SharedItem(id: id, kind: .image, text: nil, imageFile: file, sourceApp: sourceApp, sharedAt: .now))
    }

    static func pending() -> [SharedItem] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(SharedItem.self, from: Data(contentsOf: $0)) }
            .sorted { $0.sharedAt > $1.sharedAt }
    }

    static func imageData(for item: SharedItem) -> Data? {
        item.imageFile.flatMap { try? Data(contentsOf: directory.appending(path: $0)) }
    }

    static func remove(_ item: SharedItem) {
        try? FileManager.default.removeItem(at: directory.appending(path: "\(item.id.uuidString).json"))
        if let file = item.imageFile { try? FileManager.default.removeItem(at: directory.appending(path: file)) }
    }

    private static func write(_ item: SharedItem) throws {
        let data = try JSONEncoder().encode(item)
        try data.write(to: directory.appending(path: "\(item.id.uuidString).json"), options: .atomic)
    }
}
