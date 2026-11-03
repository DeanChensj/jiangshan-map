import Foundation
import CoreLocation

struct AtlasCatalog: Decodable, Sendable {
    let version: String
    let dynasties: [Dynasty]
    let places: [AtlasPlace]
    let events: [AtlasEvent]
    let journeys: [AtlasJourney]
    let cityLore: [CityLore]
    let people: [PersonProfile]
    let passes: [StrategicPass]
    let music: [MusicTrack]
    let corridors: [HistoricalCorridor]
    let cameraBounds: [String: [Double]]
    let playbackStops: [AtlasPlaybackStop]
}

struct Dynasty: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let titleEn: String
    let from: Int
    let to: Int
    let focus: Int
    let tint: String
    let summary: String
    let summaryEn: String
    let phases: [AtlasPhase]
    var seat: String? = nil
    var seatEn: String? = nil

    func phase(at year: Int) -> AtlasPhase? {
        phases.first { year >= $0.from && year <= $0.to } ?? phases.last
    }
}

struct AtlasPhase: Decodable, Identifiable, Sendable {
    let id: String
    let from: Int
    let to: Int
    let overview: String
}

struct AtlasPlace: Decodable, Identifiable, Sendable {
    let id: String
    let dynasty: String
    let title: String
    let titleEn: String
    let modern: String
    let modernEn: String
    let coord: [Double]
    let from: Int
    let to: Int
    let capital: Bool
    let capitalPeriods: [[Int]]
    let tier: Int
    let remark: String
    let remarkEn: String
    let aliases: [String]
    var align: String? = nil
    let eraNames: [EraName]

    var coordinate: CLLocationCoordinate2D { .init(latitude: coord[1], longitude: coord[0]) }
    func isCapital(at year: Int) -> Bool {
        capital && (capitalPeriods.isEmpty || capitalPeriods.contains { $0.count == 2 && year >= $0[0] && year <= $0[1] })
    }
    func name(at year: Int, english: Bool) -> String {
        if let era = eraNames.last(where: { year >= $0.from && year < $0.until }) {
            return english ? era.en : era.zh
        }
        return english ? titleEn : title
    }

    struct EraName: Decodable, Sendable {
        let from: Int
        let until: Int
        let zh: String
        let en: String
        enum CodingKeys: String, CodingKey { case from, until, zh, en }
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            from = try c.decodeIfPresent(Int.self, forKey: .from) ?? -9999
            until = try c.decodeIfPresent(Int.self, forKey: .until) ?? 9999
            zh = try c.decode(String.self, forKey: .zh)
            en = try c.decodeIfPresent(String.self, forKey: .en) ?? zh
        }
    }
}

struct AtlasEvent: Decodable, Identifiable, Sendable {
    let id: String
    let dynasty: String
    let year: Int
    let title: String
    let titleEn: String
    let site: String
    var coord: [Double]
    let major: Bool
    let coords: [[Double]]?
    var siteEn: String? = nil
    var source: String? = nil
    var sealStop: Int? = nil
    var anchors: [AtlasAnchor]? = nil
    var navigationYear:Int? = nil
    var effectiveYear:Int { navigationYear ?? year }
    var coordinate: CLLocationCoordinate2D { .init(latitude: coord[1], longitude: coord[0]) }
}

struct AtlasJourney: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let titleEn: String
    let short: String
    let shortEn: String
    let color: String
    let stops: [JourneyStop]
}

struct JourneyStop: Decodable, Identifiable, Sendable {
    let id: String
    let year: Int
    let title: String
    let titleEn: String
    let site: String
    let siteEn: String
    let detail: String
    let detailEn: String
    let quote: String
    let quoteEn: String
    let coord: [Double]
    var via: [[Double]]? = nil
}

struct CityLore: Decodable, Sendable {
    let modern: String
    let coord: [Double]
    let tagZh: String
    let tagEn: String
    let descZh: String
    let descEn: String
}

enum AtlasSelection: Identifiable {
    case place(AtlasPlace)
    case event(AtlasEvent)
    case coordinate(id: String, title: String, coord: [Double])
    case territory(id: String, title: String, subtitle: String)

    var id: String {
        switch self {
        case .coordinate(let id, _, _): id
        case .place(let place): place.id
        case .event(let event): event.id
        case .territory(let id, _, _): id
        }
    }
    func title(english: Bool) -> String {
        switch self {
        case .coordinate(_, let title, _): title
        case .place(let place): english ? place.titleEn : place.title
        case .event(let event): english ? event.titleEn : event.title
        case .territory(_, let title, let subtitle): english ? subtitle : title
        }
    }
}

struct AtlasBookmark: Codable, Identifiable {
    let id: UUID
    let title: String
    let year: Int
    let longitude: Double
    let latitude: Double
    let zoom: Double
    let url: String?
}

struct CameraDestination {
    let id = UUID()
    let longitude: Double
    let latitude: Double
    let zoom: Double
    var bounds: [Double]? = nil
    var ensureVisible = false
    var waitsForLayout = true
}

enum AtlasResources {
    static var directory: URL { Bundle.main.bundleURL.appendingPathComponent("Atlas", isDirectory: true) }
    static func url(_ name: String) -> URL { directory.appendingPathComponent(name) }
}

struct MapPolity: Identifiable {
    let id: String, title: String, titleEn: String, tint: String
    let coord: [Double]
    var bounds: [Double]? = nil
    var role: String? = nil
}

struct HistoricalCorridor: Decodable, Identifiable, Sendable {
    let key: String, title: String, titleEn: String, summary: String, summaryEn: String
    let kind: String, span: [Int], labelAt: [Double]
    var id: String { key }
}
struct AtlasMapNote {
    let title:String,detail:String
    var sourceURL:URL? = nil
    var titleEn:String? = nil
    var detailEn:String? = nil
    var focusSiteID:String? = nil
}

struct AtlasFocusSite:Decodable,Identifiable {
    let id:String,title:String,titleEn:String,detail:String,detailEn:String,sourceURL:String
    let coord:[Double]
    let from:Int,until:Int
    let city:String
    let kind:String
    let names:[AtlasFocusName]?
    func isVisible(at year:Int)->Bool {
        year >= from && year <= until && (names == nil || names!.contains { year >= $0.from && year <= $0.until })
    }
    func name(at year:Int,english:Bool)->String {
        if let name=names?.first(where:{ year >= $0.from && year <= $0.until }) { return english ? name.titleEn : name.title }
        return english ? titleEn : title
    }
    var searchText:String { ([title,titleEn,city == "changan" ? "长安 西安 Chang’an Changan Xi’an Xian" : "洛阳 Luoyang"]+(names ?? []).flatMap { [$0.title,$0.titleEn] }).joined(separator:" ") }
}

struct AtlasFocusName:Decodable { let from:Int,until:Int;let title:String,titleEn:String }

struct AtlasPlaybackStop: Decodable, Sendable { let year: Int; let hold: Bool }

struct AtlasAnchor: Decodable,Sendable { let title:String,titleEn:String;let coord:[Double] }
