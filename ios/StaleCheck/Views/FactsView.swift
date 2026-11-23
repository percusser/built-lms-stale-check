import SwiftUI

struct FactsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List(model.facts) { fact in
            VStack(alignment: .leading, spacing: 4) {
                Text(fact.statement)
                Text(model.lessonTitle(for: fact)).font(.caption).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Lesson facts")
    }
}
