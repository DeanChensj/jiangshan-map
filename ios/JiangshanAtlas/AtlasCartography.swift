import Foundation
import UIKit
import MapLibre

/// The web atlas's cartographic hierarchy, expressed as native style layers.
enum AtlasCartography {
    static let font = "Noto Serif Regular"
    static func styleURL() -> URL {
        let empty: [String: Any] = ["type":"FeatureCollection","features":[]]
        func source(_ file: String? = nil) -> [String: Any] { ["type":"geojson","data":file.map { AtlasResources.url($0).absoluteString } ?? empty as Any] }
        func layer(_ id: String, _ type: String, _ source: String, _ paint: [String: Any], filter: [Any]? = nil, layout: [String: Any] = [:]) -> [String: Any] {
            var result: [String: Any] = ["id":id,"type":type,"source":source,"paint":paint]
            if let filter { result["filter"] = filter }; if !layout.isEmpty { result["layout"] = layout }; return result
        }
        func labels(_ size: Double, spacing: Double = 0.08) -> [String: Any] {
            ["text-field":["get","title"],"text-font":[font],"text-size":size,"text-letter-spacing":spacing,"text-padding":3,"text-max-width":12,"symbol-sort-key":["coalesce",["get","sort"],10]]
        }
        let halo: [String: Any] = ["text-color":"#2b2622","text-halo-color":"#f8f3e8","text-halo-width":1.3]
        var city = labels(11, spacing: 0.01)
        city.merge(["text-variable-anchor":["left","right","top","bottom"],"text-radial-offset":0.65]) { _,new in new }
        var pass = city; pass["icon-image"] = "pass-gate"; pass["icon-size"] = 0.65
        var capital = city; capital["icon-image"] = "capital"; capital["icon-size"] = 0.65
        var numbered = labels(11, spacing: 0); numbered["text-field"] = ["get","number"]; numbered["text-allow-overlap"] = true
        var layers: [[String: Any]] = [
            ["id":"paper","type":"background","paint":["background-color":"#d6e0de"]],
            layer("relief","raster","relief",["raster-opacity":0.48,"raster-fade-duration":0]),
            layer("neighbors","fill","neighbors",["fill-color":"#e7dfd0","fill-opacity":0.08]),
            layer("neighbor-borders","line","neighbors",["line-color":"rgba(164,148,128,0.34)","line-width":0.48]),
            layer("land","fill","provinces",["fill-color":"#efe8da","fill-opacity":0]),
            layer("realms","fill","atlas",["fill-color":["case",["==",["get","role"],"neighbor"],"#a87a4c",["get","tint"]],"fill-opacity":["match",["get","role"],"neighbor",0.11,"protectorate",0.2,"rival",0.28,0.3]],filter:["==","layer","polity"]),
            layer("realm-borders","line","atlas",["line-color":["get","tint"],"line-width":["match",["get","role"],"rival",1.75,1.9],"line-opacity":0.9],filter:["all",["==","layer","polity"],["!=","role","neighbor"],["!=","role","protectorate"]],layout:["line-join":"round"]),
            layer("protectorate-borders","line","atlas",["line-color":["get","tint"],"line-width":1.4,"line-dasharray":[3.5,2]],filter:["all",["==","layer","polity"],["==","role","protectorate"]]),
            layer("prefectures","line","mesh",["line-color":"rgba(43,38,34,0.15)","line-width":0.42,"line-dasharray":[4.7,3.5]],filter:["==","layer","prefecture"]),
            layer("regions-casing","line","mesh",["line-color":"rgba(250,244,232,0.68)","line-width":3],filter:["==","layer","region"]),
            layer("regions","line","mesh",["line-color":"rgba(104,28,12,0.88)","line-width":1.45,"line-dasharray":[4.8,2.1]],filter:["==","layer","region"]),
            layer("modern-fill","fill","provinces",["fill-color":"#9e2a2b","fill-opacity":0.08],layout:["visibility":"none"]),
            layer("modern-casing","line","provinceMesh",["line-color":"rgba(250,244,232,0.65)","line-width":2.4]),
            layer("modern","line","provinceMesh",["line-color":"#c7bba6","line-width":0.75],filter:["==","layer","interior"]),
            layer("modern-outer","line","provinceMesh",["line-color":"#b9a88b","line-width":1.05],filter:["==","layer","outer"]),
            layer("modern-maritime","line","provinceMesh",["line-color":"#8f8774","line-width":1,"line-dasharray":[5,4]],filter:["==","layer","maritime"]),
            layer("admin-hit","fill","atlas",["fill-opacity":0],filter:["in","layer","prefecture","region"]),
            layer("selected-admin","fill","atlas",["fill-color":"#b5452f","fill-opacity":0.22],filter:["==","id",""]),
            layer("selected-admin-outline","line","atlas",["line-color":"#b5452f","line-width":1.45],filter:["==","id",""]),
            layer("lakes","fill","water",["fill-color":["case",["<=",["get","rank"],2],"rgba(82,150,184,0.72)","rgba(96,158,188,0.62)"]],filter:["==","layer","lake"]),
            layer("lake-outlines","line","water",["line-color":"rgba(44,108,138,0.78)","line-width":0.65],filter:["==","layer","lake"]),
            layer("rivers-casing","line","water",["line-color":"rgba(246,239,225,0.48)","line-width":2.9],filter:["all",["==","layer","river"],["==","rank",1]],layout:["line-cap":"round","line-join":"round"]),
            layer("rivers","line","water",["line-color":["match",["get","rank"],1,"rgba(36,102,136,0.90)",2,"rgba(48,114,146,0.82)",3,"rgba(66,128,158,0.68)",4,"rgba(66,128,158,0.68)","rgba(94,144,168,0.44)"],"line-width":["match",["get","rank"],1,1.75,2,1.25,3,0.9,4,0.9,0.58]],filter:["==","layer","river"],layout:["line-cap":"round","line-join":"round"]),
            layer("ghost-fill","fill","ghost",["fill-color":["get","tint"],"fill-opacity":0]),
            layer("ghost","line","ghost",["line-color":["get","tint"],"line-width":1.5,"line-dasharray":[4,3],"line-opacity":0.45]),
            layer("journey-route","line","journey",["line-color":["get","color"],"line-width":2,"line-opacity":["coalesce",["get","opacity"],0.8]],filter:["all",["==","$type","LineString"],["==","future",false]],layout:["line-cap":"round","line-join":"round"]),
            layer("journey-future","line","journey",["line-color":["get","color"],"line-width":1.8,"line-opacity":["get","opacity"],"line-dasharray":[3,3]],filter:["all",["==","$type","LineString"],["==","future",true]]),
            layer("neighbor-labels","symbol","neighborLabels",["text-color":"rgba(104,110,115,0.68)","text-halo-color":"#f6f0e4","text-halo-width":1],layout:labels(10,spacing:0.06)),
            layer("hydro-labels","symbol","hydroLabels",["text-color":["match",["get","kind"],"range","#604628","desert","#604624","#144c6c"],"text-halo-color":"rgba(246,240,228,0.9)","text-halo-width":1],layout:labels(11).merging(["text-rotate":["get","rotation"],"text-letter-spacing":["match",["get","kind"],"range",0.5,"desert",1.1,0.1]]) { _,new in new }),
            layer("region-labels","symbol","labels",["text-color":"#522212","text-halo-color":"#f8f3e8","text-halo-width":1.15],filter:["==","layer","region"],layout:labels(12)),
            layer("realm-labels","symbol","labels",["text-color":["case",["==",["get","role"],"neighbor"],"#5a2d18","#1c1612"],"text-halo-color":"#f8f3e8","text-halo-width":1.55],filter:["==","layer","polity"],layout:labels(19,spacing:0.18)),
            layer("modern-labels","symbol","modernLabels",["text-color":"#6c5645","text-halo-color":"#f8f3e8","text-halo-width":1],layout:labels(12)),
            layer("city-dots","circle","places",["circle-radius":2.2,"circle-color":"#fffdf8","circle-stroke-color":"#2b2622","circle-stroke-width":1.1],filter:["all",["==","capital",false],["==","tier",1]]),
            layer("capital-labels","symbol","places",halo.merging(["text-color":"#72190b"]) { _,new in new },filter:["==","capital",true],layout:capital),
            layer("city-labels","symbol","places",halo,filter:["all",["==","tier",1],["==","capital",false]],layout:city),
            layer("town-dots","circle","places",["circle-radius":1.7,"circle-color":"#f6efe2","circle-stroke-color":"#4e453d","circle-stroke-width":0.95],filter:["all",["==","tier",2],["==","capital",false]]),
            layer("town-labels","symbol","places",halo,filter:["all",["==","tier",2],["==","capital",false]],layout:city),
            layer("prefecture-labels","symbol","labels",["text-color":"#785944","text-halo-color":"#f8f3e8","text-halo-width":1],filter:["==","layer","prefecture"],layout:labels(10)),
            layer("focus-dots","circle","focusSites",["circle-radius":4,"circle-color":["match",["get","kind"],"palace","#b5452f","gate","#36637a","#9c6317"],"circle-stroke-color":"#fff8e7","circle-stroke-width":1.5]),
            layer("focus-labels","symbol","focusSites",["text-color":"#684012","text-halo-color":"#fff8e7","text-halo-width":1.5],layout:labels(13).merging(["text-variable-anchor":["top","bottom","left","right"],"text-radial-offset":0.7]) { _,new in new }),
            layer("pass-labels","symbol","passes",["text-color":"#6b4830","text-halo-color":"#f8f3e8","text-halo-width":1],layout:pass),
            layer("capital-hint","symbol","places",["text-color":"#b5452f"],filter:["==","hintCapital",true],layout:["text-field":["get","hint"],"text-font":[font],"text-size":10,"text-offset":[0,-2.3],"icon-image":"hint-pill","icon-text-fit":"both","icon-text-fit-padding":[4,7,4,7],"text-allow-overlap":true,"icon-allow-overlap":true]),
            layer("event-dots","symbol","events",["icon-opacity":["case",["get","current"],1,0.45]],layout:["icon-image":"event","icon-size":["case",["get","current"],0.8,0.55],"icon-allow-overlap":true]),
            layer("journey-stops","symbol","journey",["icon-opacity":["coalesce",["get","opacity"],1]],filter:["==","$type","Point"],layout:["icon-image":["get","icon"],"icon-offset":["get","iconOffset"],"icon-allow-overlap":true,"symbol-sort-key":["get","sort"]]),
            layer("journey-numbers","symbol","journey",["text-color":"#fff7e7","text-opacity":["coalesce",["get","opacity"],1]],filter:["==","$type","Point"],layout:numbered.merging(["text-offset":["get","textOffset"]]) { _,new in new }),
            layer("journey-labels","symbol","journey",halo,filter:["==","$type","Point"],layout:city.merging(["text-offset":[0,1.6],"symbol-sort-key":["get","sort"]]) { _,new in new }),
            layer("journey-arrows","symbol","journey",["text-color":["get","color"]],filter:["==","$type","LineString"],layout:["symbol-placement":"line","text-field":"›","text-font":[font],"text-size":18,"symbol-spacing":90,"text-keep-upright":false]),
            layer("quiz-lines","line","quiz",["line-color":["case",["get","hit"],"#b5452f","#a78e6d"],"line-width":["case",["get","hit"],2.2,1],"line-dasharray":[3,2]],filter:["==","$type","LineString"]),
            layer("quiz-pins","circle","quiz",["circle-radius":7,"circle-color":["get","color"],"circle-stroke-width":2,"circle-stroke-color":"#fff6e4"],filter:["all",["==","$type","Point"],["!=","kind","ring"]]),
            layer("quiz-labels","symbol","quiz",halo,filter:["==","$type","Point"],layout:city),
            layer("selection-ring","circle","selection",["circle-radius":11,"circle-color":"#b5452f","circle-opacity":0.1,"circle-stroke-width":1.5,"circle-stroke-color":"#b5452f"]),
            layer("selected-label","symbol","selection",halo,layout:city.merging(["text-allow-overlap":true]) { _,new in new })
        ]
        for (kind,color,width,dash) in [("wall","#5a3826",2.4,[2.1,1.05]),("canal","#1f6f8b",2.2,[3.2,1.4]),("silk","#9c6317",1.7,[1.5,2.1]),("road","#9c6317",1.7,[1.5,2.1]),("sea","#2c5d8f",1.7,[1.2,2.4])] {
            layers.insert(layer("corridor-"+kind,"line","corridors",["line-color":color,"line-width":width,"line-dasharray":dash],filter:["==","kind",kind],layout:["line-cap":"round"]),at:22)
        }
        var corridorLabels=labels(11);corridorLabels["text-rotate"]=["get","rotation"]
        layers.insert(layer("corridor-labels","symbol","corridorLabels",["text-color":"#4a341c","text-halo-color":"#f8f3e8","text-halo-width":1.1],layout:corridorLabels),at:28)
        for i in layers.indices where ["realm-labels","region-labels","capital-labels","city-labels","town-labels","corridor-labels"].contains(layers[i]["id"] as? String ?? "") {
            var layout=layers[i]["layout"] as? [String:Any] ?? [:];layout["text-font"]=["Noto Serif Bold"];layers[i]["layout"]=layout
        }
        for i in layers.indices {
            let id=layers[i]["id"] as? String ?? ""
            if ["focus-dots","focus-labels"].contains(id) { layers[i]["minzoom"]=7.0 }
            if id == "realm-labels" { layers[i]["maxzoom"]=9.0 }
        }
        let glyph = Bundle.main.url(forResource:"Glyphs",withExtension:nil)!
        let style: [String:Any] = ["version":8,"name":"江山 · web cartography","glyphs":glyph.absoluteString+"/{fontstack}/{range}.pbf","sources":["focusSites":source("focus-sites.geojson"),"atlas":source(),"labels":source(),"mesh":source(),"places":source(),"events":source(),"journey":source(),"selection":source(),"ghost":source(),"passes":source(),"hydroLabels":source(),"quiz":source(),"neighbors":source("neighbors.geojson"),"neighborLabels":source("neighbor-labels.geojson"),"provinces":source("provinces.geojson"),"provinceMesh":source("province-mesh.geojson"),"modernLabels":source("modern-labels.geojson"),"water":source("water.geojson"),"corridors":source("corridors.geojson"),"corridorLabels":source("corridor-labels.geojson"),"relief":["type":"image","url":AtlasResources.url("terrain.png").absoluteString,"coordinates":[[59.92,57.03634564],[148.08,57.03634564],[148.08,10.43886278],[59.92,10.43886278]]]],"layers":layers]
        let url=FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("atlas-style.json")
        try! JSONSerialization.data(withJSONObject:style).write(to:url,options:.atomic)
        return url
    }
    static func journeyPin(_ style: MLNStyle,color:String,encounter:Bool,relic:Bool)->String {
        let name="pin-\(color)-\(encounter)-\(relic)"
        if style.image(forName:name) != nil { return name }
        let image=UIGraphicsImageRenderer(size:.init(width:26,height:26)).image { context in
            let c=context.cgContext
            let hex=UInt32(color.trimmingCharacters(in:CharacterSet.alphanumerics.inverted),radix:16) ?? 0xb5452f
            c.setFillColor(UIColor(red:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1).cgColor)
            if relic { c.fill(.init(x:3,y:3,width:20,height:20)) } else { c.fillEllipse(in:.init(x:3,y:3,width:20,height:20)) }
            c.setStrokeColor((encounter ? UIColor(red:0.78,green:0.58,blue:0.17,alpha:1) : .white).cgColor);c.setLineWidth(encounter ? 3 : 1.5)
            if relic { c.stroke(.init(x:3,y:3,width:20,height:20)) } else { c.strokeEllipse(in:.init(x:3,y:3,width:20,height:20)) }
        };style.setImage(image,forName:name);return name
    }
    static func installSymbols(_ style: MLNStyle) {
        func draw(_ name: String, _ body: (CGContext)->Void) {
            let image=UIGraphicsImageRenderer(size:.init(width:24,height:24)).image { c in body(c.cgContext) }
            style.setImage(image,forName:name)
        }
        draw("hint-pill") { c in c.setFillColor(UIColor(red:0.99,green:0.97,blue:0.92,alpha:0.97).cgColor);c.setStrokeColor(UIColor(red:0.71,green:0.27,blue:0.18,alpha:0.6).cgColor);c.setLineWidth(1);let shape=UIBezierPath(roundedRect:.init(x:1,y:1,width:22,height:22),cornerRadius:6);c.addPath(shape.cgPath);c.drawPath(using:.fillStroke) }
        draw("capital") { c in
            c.setStrokeColor(UIColor(red:0.71,green:0.27,blue:0.18,alpha:1).cgColor);c.setLineWidth(1.4);c.strokeEllipse(in:.init(x:4,y:4,width:16,height:16))
            c.setFillColor(UIColor(red:0.71,green:0.27,blue:0.18,alpha:1).cgColor);c.move(to:.init(x:12,y:6));c.addLines(between:[.init(x:18,y:12),.init(x:12,y:18),.init(x:6,y:12)]);c.closePath();c.fillPath()
        }
        draw("event") { c in c.setFillColor(UIColor(red:0.71,green:0.27,blue:0.18,alpha:1).cgColor);c.move(to:.init(x:12,y:5));c.addLines(between:[.init(x:19,y:12),.init(x:12,y:19),.init(x:5,y:12)]);c.closePath();c.fillPath();c.setLineWidth(1);c.setStrokeColor(UIColor.white.cgColor);c.strokeEllipse(in:.init(x:2,y:2,width:20,height:20)) }
        draw("pass-gate") { c in
            c.setFillColor(UIColor(red:0.42,green:0.28,blue:0.18,alpha:1).cgColor)
            c.fill(.init(x:3,y:9,width:18,height:10));for x in [3,10,17] { c.fill(.init(x:x,y:5,width:4,height:5)) };c.setBlendMode(.clear);c.fill(.init(x:10,y:13,width:4,height:6))
        }
    }

    static func convergencePin(_ style: MLNStyle,color:String,peerColor:String)->String {
        let name="meet-\(color)-\(peerColor)"
        guard style.image(forName:name) == nil else { return name }
        func uiColor(_ value:String)->UIColor {
            let hex=UInt32(value.trimmingCharacters(in:CharacterSet.alphanumerics.inverted),radix:16) ?? 0xb5452f
            return UIColor(red:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1)
        }
        let image=UIGraphicsImageRenderer(size:.init(width:42,height:26)).image { context in
            UIColor(red:1,green:0.98,blue:0.94,alpha:1).setFill()
            let pill=UIBezierPath(roundedRect:.init(x:1,y:2,width:40,height:22),cornerRadius:11);pill.fill()
            uiColor(color).setFill();context.cgContext.fillEllipse(in:.init(x:2,y:3,width:20,height:20))
            uiColor(peerColor).setFill();context.cgContext.fillEllipse(in:.init(x:20,y:3,width:20,height:20))
            UIColor(red:0.78,green:0.58,blue:0.17,alpha:1).setStroke();pill.lineWidth=1.4;pill.stroke()
        }
        style.setImage(image,forName:name);return name
    }
}
