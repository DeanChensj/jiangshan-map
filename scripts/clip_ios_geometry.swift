// Apply the web's polity clip to native administrative fills and boundary lines.
// Run once during export; historical query geometry and label anchors stay intact.
import Foundation
import CoreGraphics

typealias Object = [String: Any]
func project(_ p: [Double]) -> CGPoint {
    CGPoint(x: p[0] * .pi / 180, y: log(tan(.pi / 4 + p[1] * .pi / 360)))
}
func coordinate(_ p: CGPoint) -> [Double] {
    [p.x * 180 / .pi, (2 * atan(exp(p.y)) - .pi / 2) * 180 / .pi].map { ($0 * 1e7).rounded() / 1e7 }
}
func makePath(_ geometry: Object) -> CGPath {
    let path = CGMutablePath()
    func append(_ points: [[Double]], closed: Bool) {
        guard let first = points.first else { return }
        path.move(to: project(first))
        for point in points.dropFirst() { path.addLine(to: project(point)) }
        if closed { path.closeSubpath() }
    }
    switch geometry["type"] as? String {
    case "Polygon": (geometry["coordinates"] as! [[[Double]]]).forEach { append($0, closed: true) }
    case "MultiPolygon": (geometry["coordinates"] as! [[[[Double]]]]).forEach { $0.forEach { append($0, closed: true) } }
    case "LineString": append(geometry["coordinates"] as! [[Double]], closed: false)
    case "MultiLineString": (geometry["coordinates"] as! [[[Double]]]).forEach { append($0, closed: false) }
    default: break
    }
    return path
}
func subpaths(_ path: CGPath, closed: Bool) -> [[CGPoint]] {
    var result: [[CGPoint]] = [], points: [CGPoint] = []
    func flush() {
        if closed, let first = points.first, points.last != first { points.append(first) }
        if points.count >= (closed ? 4 : 2) { result.append(points) }
        points = []
    }
    path.applyWithBlock { element in
        let e = element.pointee
        switch e.type {
        case .moveToPoint: flush(); points = [e.points[0]]
        case .addLineToPoint: points.append(e.points[0])
        case .closeSubpath:
            if let first = points.first, points.last != first { points.append(first) }
            flush()
        case .addQuadCurveToPoint:
            guard let start = points.last else { return }
            for i in 1...8 {
                let t = CGFloat(i) / 8, u = 1 - t
                points.append(CGPoint(x: u*u*start.x + 2*u*t*e.points[0].x + t*t*e.points[1].x,
                                      y: u*u*start.y + 2*u*t*e.points[0].y + t*t*e.points[1].y))
            }
        case .addCurveToPoint:
            guard let start = points.last else { return }
            for i in 1...12 {
                let t = CGFloat(i) / 12, u = 1 - t
                points.append(CGPoint(x: u*u*u*start.x + 3*u*u*t*e.points[0].x + 3*u*t*t*e.points[1].x + t*t*t*e.points[2].x,
                                      y: u*u*u*start.y + 3*u*u*t*e.points[0].y + 3*u*t*t*e.points[1].y + t*t*t*e.points[2].y))
            }
        @unknown default: break
        }
    }
    flush()
    return result
}
func polygonGeometry(_ path: CGPath) -> Object? {
    let rings = subpaths(path, closed: true)
    guard !rings.isEmpty else { return nil }
    let areas = rings.map { ring in abs(zip(ring, ring.dropFirst()).reduce(0) { $0 + $1.0.x * $1.1.y - $1.1.x * $1.0.y }) }
    let ringPaths = rings.map { ring -> CGPath in
        let p = CGMutablePath(); p.addLines(between: ring); p.closeSubpath(); return p
    }
    // Ring containment preserves holes and islands without relying on source winding.
    let parents: [Int?] = rings.indices.map { i in
        rings.indices.filter { j in j != i && areas[j] > areas[i] && ringPaths[j].contains(rings[i][0], using: .evenOdd) }
            .min { areas[$0] < areas[$1] }
    }
    func depth(_ i: Int) -> Int { parents[i].map { 1 + depth($0) } ?? 0 }
    let polygons = rings.indices.filter { depth($0) % 2 == 0 }.map { i in
        ([i] + rings.indices.filter { parents[$0] == i }).map { rings[$0].map(coordinate) }
    }
    if polygons.count == 1 { return ["type": "Polygon", "coordinates": polygons[0]] }
    return ["type": "MultiPolygon", "coordinates": polygons]
}
func read(_ url: URL) throws -> Object { try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! Object }
func write(_ value: Object, _ url: URL) throws {
    try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: url, options: .atomic)
}
func selfTest() {
    let outer = [[0.0,0],[10,0],[10,10],[0,10],[0,0]], hole = [[4.0,4],[6,4],[6,6],[4,6],[4,4]]
    let mask = makePath(["type":"Polygon", "coordinates":[outer,hole]])
    let big = makePath(["type":"Polygon", "coordinates":[[[-2.0,-2],[12,-2],[12,12],[-2,12],[-2,-2]]]])
    let clipped = polygonGeometry(big.intersection(mask, using: .evenOdd))!
    let shape = makePath(clipped)
    precondition(shape.contains(project([1,1]), using: .evenOdd))
    precondition(!shape.contains(project([5,5]), using: .evenOdd), "Keep interior holes")
    precondition(!shape.contains(project([11,1]), using: .evenOdd), "Cut outside territory")
    let line = makePath(["type":"LineString", "coordinates":[[-1.0,5],[11,5]]])
    let pieces = subpaths(line.lineIntersection(mask, using: .evenOdd), closed: false)
    precondition(pieces.count == 2 && pieces.allSatisfy { $0.count == 2 }, "Clip existing lines without adding mask edges")
    let island = makePath(["type":"Polygon", "coordinates":[[[20.0,0],[22,0],[22,2],[20,2],[20,0]]]])
    let multi = polygonGeometry(mask.union(island, using: .evenOdd))!
    precondition(multi["type"] as? String == "MultiPolygon", "Keep disconnected islands")
    print("Native administrative clipping fixtures passed")
}
if CommandLine.arguments.dropFirst().first == "--test" {
    selfTest()
} else {
    let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    let snapshots = root.appendingPathComponent("snapshots", isDirectory: true)
    var count = 0
    for url in try FileManager.default.contentsOfDirectory(at: snapshots, includingPropertiesForKeys: nil).sorted(by: { $0.path < $1.path }) where url.pathExtension == "geojson" {
        var data = try read(url)
        let features = data["features"] as! [Object]
        var mask: CGPath?
        for feature in features {
            let p = feature["properties"] as! Object
            if p["layer"] as? String == "polity", p["role"] as? String != "neighbor" {
                let path = makePath(feature["geometry"] as! Object)
                mask = mask.map { $0.union(path, using: .evenOdd) } ?? path
            }
        }
        guard let mask else { continue }
        data["features"] = features.compactMap { feature -> Object? in
            let p = feature["properties"] as! Object
            guard ["prefecture","region"].contains(p["layer"] as? String ?? "") else { return feature }
            guard let clipped = polygonGeometry(makePath(feature["geometry"] as! Object).intersection(mask, using: .evenOdd)) else { return nil }
            var result = feature; result["geometry"] = clipped; return result
        }
        try write(data, url)
        let meshURL = root.appendingPathComponent("meshes/" + url.lastPathComponent)
        var mesh = try read(meshURL)
        mesh["features"] = (mesh["features"] as! [Object]).compactMap { feature -> Object? in
            let lines = subpaths(makePath(feature["geometry"] as! Object).lineIntersection(mask, using: .evenOdd), closed: false)
            if lines.isEmpty { return nil }
            var result = feature
            result["geometry"] = ["type":"MultiLineString", "coordinates":lines.map { $0.map(coordinate) }]
            return result
        }
        try write(mesh, meshURL)
        count += 1
    }
    print("Clipped native administrative geometry in \(count) stages")
}
