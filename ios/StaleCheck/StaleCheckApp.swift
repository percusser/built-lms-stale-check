import FirebaseAppCheck
import FirebaseCore
import SwiftUI

@main
struct StaleCheckApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else { return }
        #if DEBUG
        if let url = Bundle.main.url(forResource: "appcheck-debug-token", withExtension: "txt"),
           let token = try? String(contentsOf: url, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) {
            UserDefaults.standard.set(token, forKey: "FIRAAppCheckDebugToken")
        }
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(StaleCheckAppCheckFactory())
        #endif
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            InboxView()
                .environment(model)
                .task(id: scenePhase) {
                    if scenePhase == .active { await model.refresh() }
                }
        }
    }
}

final class StaleCheckAppCheckFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        AppAttestProvider(app: app)
    }
}
