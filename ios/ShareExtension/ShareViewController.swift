import SwiftUI
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: ShareConfirmation(state: .saving) { [weak self] in self?.finish() })
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
        nonisolated(unsafe) let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        Task { [weak self] in
            let saved = await Self.save(providers)
            host.rootView = ShareConfirmation(state: saved ? .saved : .nothing) { self?.finish() }
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    nonisolated private static func save(_ providers: [NSItemProvider]) async -> Bool {
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier),
               let data = try? await provider.loadDataRepresentation(for: .image) {
                if (try? SharedInbox.save(imageData: data)) != nil { return true }
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
               let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String,
               !text.isEmpty {
                if (try? SharedInbox.save(text: text)) != nil { return true }
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
               let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                if (try? SharedInbox.save(text: url.absoluteString, kind: .url)) != nil { return true }
            }
        }
        return false
    }
}

private extension NSItemProvider {
    func loadDataRepresentation(for type: UTType) async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            _ = loadDataRepresentation(for: type) { data, error in
                if let data { continuation.resume(returning: data) } else { continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown)) }
            }
        }
    }
}

struct ShareConfirmation: View {
    enum State { case saving, saved, nothing }
    let state: State
    let done: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            switch state {
            case .saving:
                ProgressView("Saving")
            case .saved:
                Label("Saved for checking", systemImage: "checkmark.circle.fill")
                    .font(.title3.weight(.semibold))
                Text("Open Stale Check to see whether this changes any of your training.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            case .nothing:
                Label("Nothing to check", systemImage: "exclamationmark.triangle")
                    .font(.title3.weight(.semibold))
                Text("Share text, a link or a screenshot.")
                    .foregroundStyle(.secondary)
            }
            Button("Done", action: done)
                .buttonStyle(.borderedProminent)
                .disabled(state == .saving)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
