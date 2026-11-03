// Bake the web atlas's edge fade into its native raster resource.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
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
guard let rendered, let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot export terrain") }
CGImageDestinationAddImage(destination, rendered, nil)
assert(CGImageDestinationFinalize(destination))
