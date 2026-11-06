import SwiftUI
import CoreText

enum AtlasFonts {
    static func register() {
        guard let folder = Bundle.main.url(forResource: "Fonts", withExtension: nil),
              let urls = try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil) else { return }
        for url in urls where url.pathExtension == "ttf" { CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil) }
    }
    static func ui(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(weight == .bold || weight == .semibold ? "NotoSansSC-Bold" : weight == .medium ? "NotoSansSC-Medium" : "NotoSansSC-Regular", size: size)
    }
    static func serif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(weight == .bold ? "NotoSerifSC-Bold" : weight == .semibold || weight == .medium ? "NotoSerifSC-SemiBold" : "NotoSerifSC-Regular", size: size)
    }
    static func title(_ size: CGFloat) -> Font { .custom("MaShanZheng-Regular", size: size) }
}
