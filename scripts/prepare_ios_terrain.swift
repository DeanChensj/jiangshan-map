// Bake the web atlas's edge fade into its native raster resource.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
func save(_ image: CGImage, to output: URL) throws {
    try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot export terrain") }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot finalize terrain") }
}

if CommandLine.arguments[1] == "--tiles" {
    let input = URL(fileURLWithPath: CommandLine.arguments[2]), output = URL(fileURLWithPath: CommandLine.arguments[3])
    let index = try JSONSerialization.jsonObject(with: Data(contentsOf: input.appendingPathComponent("index.json"))) as! [String: Any]
    let size = index["tileSize"] as! Int, levels = index["levels"] as! [String: [String]]
    var count = 0
    for (zoom, keys) in levels {
        let positions = keys.map { $0.split(separator: "_").map { Int($0)! } }, present = Set(keys)
        for x in positions.map({ $0[0] }).min()!...positions.map({ $0[0] }).max()! {
            for y in positions.map({ $0[1] }).min()!...positions.map({ $0[1] }).max()! {
                var pixels = [UInt8](repeating: 0, count: size * size * 4)
                let image = pixels.withUnsafeMutableBytes { bytes -> CGImage in
                    let context = CGContext(data: bytes.baseAddress, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                    if present.contains("\(x)_\(y)") {
                        let file = input.appendingPathComponent("\(zoom)/\(x)/\(y).webp")
                        guard let source = CGImageSourceCreateWithURL(file as CFURL, nil), let tile = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Cannot decode \(file.path)") }
                        context.draw(tile, in: CGRect(x: 0, y: 0, width: size, height: size))
                        // Composite base + detail at the web's group opacity.
                        let paper = [214.0, 224.0, 222.0]
                        for offset in stride(from: 0, to: size * size * 4, by: 4) {
                            let alpha = Double(bytes[offset + 3]) / 255
                            for channel in 0..<3 {
                                bytes[offset + channel] = UInt8((0.48 * Double(bytes[offset + channel]) + 0.52 * paper[channel] * alpha).rounded())
                            }
                        }
                        count += 1
                    }
                    return context.makeImage()!
                }
                try save(image, to: output.appendingPathComponent("\(zoom)/\(x)/\(y).png"))
            }
        }
    }
    print("Native terrain: \(count) detail tiles.")
    exit(0)
}
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Cannot decode terrain") }
let width = image.width, height = image.height
var pixels = [UInt8](repeating: 0, count: width * height * 4)
let rendered: CGImage? = pixels.withUnsafeMutableBytes { bytes in
    guard let context = CGContext(data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    for y in 0..<height {
        let vertical = min(1, min(Double(y) / (Double(height) * 0.045), Double(height - 1 - y) / (Double(height) * 0.055)))
        for x in 0..<width {
            let horizontal = min(1, min(Double(x) / (Double(width) * 0.045), Double(width - 1 - x) / (Double(width) * 0.055)))
            let fade = max(0, horizontal * vertical), offset = (y * width + x) * 4
            for channel in 0..<4 { bytes[offset + channel] = UInt8(Double(bytes[offset + channel]) * fade) }
        }
    }
    return context.makeImage()
}
guard let rendered else { fatalError("Cannot render terrain") }
try save(rendered, to: output)
