import Foundation
import JavaScriptCore

/// One serial JavaScriptCore context runs the web atlas's pure historical queries.
/// Rendering, navigation, storage and gestures remain native.
final class AtlasEngine: @unchecked Sendable {
    static let shared = AtlasEngine()
    private let queue = DispatchQueue(label: "me.jiangshan.history", qos: .userInitiated)
    private var context: JSContext?

    func query<T: Decodable & Sendable>(_ operation: String, _ arguments: [String: Any], as type: T.Type = T.self) async throws -> T {
        let object:[String:Any] = ["op": operation, "args": arguments]
        guard JSONSerialization.isValidJSONObject(object) else { throw EngineError.message("Invalid historical query arguments") }
        let request = try JSONSerialization.data(withJSONObject: object)
        return try await withCheckedThrowingContinuation { continuation in
            queue.async {
                do {
                    let ctx = try self.loadContext()
                    ctx.exception = nil
                    ctx.setObject(String(decoding: request, as: UTF8.self), forKeyedSubscript: "__atlasRequest" as NSString)
                    let result = ctx.evaluateScript("(function(){const r=JSON.parse(__atlasRequest);return JSON.stringify(window.AtlasNative(r.op,r.args));})()")
                    if let exception = ctx.exception { throw EngineError.message(exception.toString() ?? "Historical query failed") }
                    guard let json = result?.toString(), let data = json.data(using: .utf8) else { throw EngineError.message("No historical result") }
                    continuation.resume(returning: try JSONDecoder().decode(T.self, from: data))
                } catch { continuation.resume(throwing: error) }
            }
        }
    }

    private func loadContext() throws -> JSContext {
        if let context { return context }
        guard let ctx = JSContext() else { throw EngineError.message("Could not load historical engine") }
        ctx.evaluateScript("""
        var window={addEventListener:function(){}},console={log:function(){},warn:function(){},error:function(){}},setTimeout=function(){return 0},clearTimeout=function(){};
        class URLSearchParams {
          constructor(){this.values={}} set(k,v){this.values[k]=String(v)}
          get(k){return this.values[k]||null}
          toString(){return Object.keys(this.values).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(this.values[k])).join('&')}
        }
        """)
        for name in ["map_data", "china_geo_data", "atlas_snapshots", "lore_data", "i18n_dict", "zh_hant", "app", "atlas_quiz", "native"] {
            let url = AtlasResources.url("Engine/\(name).js")
            ctx.evaluateScript(try String(contentsOf: url, encoding: .utf8), withSourceURL: url)
            if let error = ctx.exception { throw EngineError.message("\(name): \(error.toString() ?? "Load failed")") }
        }
        context = ctx
        return ctx
    }
    enum EngineError: LocalizedError { case message(String); var errorDescription: String? { if case .message(let text) = self { return text }; return nil } }
}

struct SearchHit: Decodable, Identifiable, Sendable {
    let id: String, kind: String, title: String, subtitle: String
    let year: Int
    let coord: [Double]?
    let person: String, polity: String
    var eventID: String? = nil
    var prefTitle: String? = nil
    var badge: String? = nil
}
struct AtlasExperience: Decodable, Identifiable, Sendable {
    let id: String, kind: String, title: String, subtitle: String
    let stops: [ExperienceStop], tracks: [ExperienceTrack], encounters: [Int]
    let distance: Double
    let place: String?, years: String?
    var profiles: [ExperiencePerson]? = nil
    var eraCount: Int? = nil
    var query: String? = nil
}
struct ExperienceTrack: Decodable, Identifiable, Sendable {
    let id: String, title: String, color: String
    let stops: [ExperienceStop]
}
struct ExperienceStop: Decodable, Identifiable, Sendable {
    let id: String
    let year: Int
    var navigationYear:Int? = nil
    var effectiveYear:Int { navigationYear ?? year }
    let coord: [Double]
    let site: String, modern: String, text: String, quote: String, color: String, person: String
    let encounter: Bool
    let via: [[Double]]
    var fromCoord: [Double]? = nil
    var number: String? = nil
    var convergencePeer: Int? = nil
    var journeyStopIndex: Int? = nil
    var dynastyID: String? = nil
    var major: Bool? = nil
    var notes: [ExperienceNote]? = nil
}
struct HistoricalDetail: Decodable, Sendable {
    let info: PlaceInfo
    let rows: [GenealogyRow]
    var adminTitles: [String]? = nil
    var heading: String? = nil
    var headingEn: String? = nil
}
struct PlaceInfo: Decodable, Sendable {
    let era: String
    let polity: String?
    let regions: [String], prefectures: [String]
    let modernProvince: String?
    let nearestCity: NearestCity?
    let lore: Lore?
    struct NearestCity: Decodable, Sendable { let ancient: String, modern: String; let distanceKm: Int; let isCapital: Bool?; let remark: String? }
    struct Lore: Decodable, Sendable { let tag: String, desc: String }
}
struct GenealogyRow: Decodable, Identifiable, Sendable {
    let id: String, title: String
    let year: Int
    let polity: String, admins: String, place: String
    let capital: Bool
    let events: [GenealogyEvent]
}
struct GenealogyEvent: Decodable, Identifiable, Sendable {
    let id: String
    let year: Int
    let title: String
    let coord: [Double]
}
struct PolityDetail: Decodable, Sendable {
    let key: String, title: String, summary: String, seat: String, rulers: String
    let from: Int, to: Int
    let titles: [String]
    let stages: [PolityStage]
    let events: [PolityEvent]
    struct PolityStage: Decodable, Identifiable, Sendable { let id: String; let from: Int, to: Int; let title: String, caption: String; var snapKey: String? = nil;var rawTitle:String? = nil }
    struct PolityEvent: Decodable, Identifiable, Sendable { let id: String; let year: Int; let title: String; let coord: [Double]? }
}
struct QuizQuestion: Decodable, Identifiable, Sendable {
    let id: String
    let year: Int
    let dynasty: String, title: String, modern: String, clue: String
    let coord: [Double]
    let tier: Int
}
struct PersonProfile: Decodable, Identifiable, Sendable {
    let key: String, zh: String, en: String
    let courtesyZh: String?, courtesyEn: String?
    let span: [Int]?
    var aliases: [String]? = nil
    var isRelic: Bool? = nil
    var id: String { key }
    func matches(_ query:String)->Bool {
        let text=zh+" "+en+" "+(courtesyZh ?? "")+" "+(courtesyEn ?? "")+" "+(aliases ?? []).joined(separator:" ")
        return query.isEmpty || (text+" "+AtlasChinese.traditional(text)).localizedCaseInsensitiveContains(query)
    }
}
struct StrategicPass: Decodable, Identifiable, Sendable {
    let key: String, ancientZh: String, ancientEn: String, modernZh: String, modernEn: String
    let rangeZh: String, rangeEn: String, chokepointZh: String, chokepointEn: String
    let coord: [Double]
    let appear: Int, vanish: Int?, focusYear: Int
    let eraNames: [AtlasPlace.EraName]?
    var id: String { key }
    func name(at year: Int, english: Bool) -> String {
        if let era = eraNames?.last(where: { year >= $0.from && year < $0.until }) { return english ? era.en : era.zh }
        return english ? ancientEn : ancientZh
    }
}
struct HydroLabel: Decodable, Sendable {
    let zh: String, en: String, kind: String
    let coord: [Double]
    let appear: Int?, vanish: Int?, rot: Double?, tier: Int?
    let eraNames: [AtlasPlace.EraName]?
}
struct MusicTrack: Decodable, Identifiable, Sendable {
    let zh: String, en: String, mp3: String
    var id: String { mp3 }
}

struct AtlasChinese {
    private struct Mapping: Decodable { let chars: [String: String], phrases: [String: String] }
    private static let mapping = try? JSONDecoder().decode(Mapping.self, from: Data(contentsOf: AtlasResources.url("hant.json")))
    private static let regex = try? NSRegularExpression(pattern: (mapping?.phrases.keys.sorted { $0.count > $1.count } ?? []).map(NSRegularExpression.escapedPattern).joined(separator: "|"))
    static func traditional(_ value: String) -> String {
        guard let mapping, let regex else { return value.applyingTransform(StringTransform("Hans-Hant"), reverse: false) ?? value }
        let ns = value as NSString
        let matches = regex.matches(in: value, range: NSRange(location: 0, length: ns.length))
        var result = "", start = 0
        func chars(_ text: String) -> String { text.map { mapping.chars[String($0)] ?? String($0) }.joined() }
        for match in matches {
            result += chars(ns.substring(with: NSRange(location: start, length: match.range.location - start)))
            let phrase = ns.substring(with: match.range)
            result += mapping.phrases[phrase] ?? phrase
            start = NSMaxRange(match.range)
        }
        return result + chars(ns.substring(from: start))
    }
}

struct ExperiencePerson: Decodable, Identifiable, Sendable { let id: String, title: String; let span: [Int]; let relic: Bool }
struct ExperienceNote: Decodable, Sendable { let person: String, text: String, color: String }

struct NativePlace:Decodable,Sendable { let coord:[Double]?;let resolvedName:String?;let year:Int?;let tokenCount:Int }
