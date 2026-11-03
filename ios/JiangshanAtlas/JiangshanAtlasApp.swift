import SwiftUI

@main
struct JiangshanAtlasApp: App {
    init() { AtlasFonts.register() }
    var body: some Scene {
        WindowGroup { AtlasSceneView() }
    }
}

struct AtlasSceneView:View {
    @State private var store = AtlasStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ContentView(store: store)
            .tint(AtlasTheme.vermilion)
            .preferredColorScheme(.light)
            .font(AtlasFonts.ui(15))
            .task {
                await store.load()
                #if DEBUG
                // Exercise the real link parser with deterministic UI-test state.
                if let raw=ProcessInfo.processInfo.environment["ATLAS_UI_TEST_URL"],let url=URL(string:raw) { await store.openLink(url) }
                #endif
            }
            .onOpenURL { store.open($0) }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active { store.saveCamera() }
            }
    }
}

enum AtlasTheme {
    static let tokens: [String:String] = (try? JSONDecoder().decode([String:String].self,from:Data(contentsOf:AtlasResources.url("theme.json")))) ?? [:]
    static let paper = Color(atlasHex:tokens["bg-parchment"] ?? "#f3eee4")
    static let ink = Color(atlasHex:tokens["text-main"] ?? "#2b2622")
    static let vermilion = Color(atlasHex:tokens["vermilion"] ?? "#b5452f")
    static let secondary = Color(atlasHex:tokens["text-secondary"] ?? "#5d554c")
}

extension Color {
    init(atlasHex: String) {
        let value = UInt(atlasHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted), radix: 16) ?? 0x9b7151
        self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
}
