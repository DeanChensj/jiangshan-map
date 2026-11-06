import MapLibre
import UIKit

/// Loaded only when requested; the bundled historical map remains usable offline.
enum AtlasTodayReference {
    static func update(_ style:MLNStyle,enabled:Bool,english:Bool) {
        if enabled,style.source(withIdentifier:"today-reference") == nil {
            let source=MLNVectorTileSource(identifier:"today-reference",configurationURL:URL(string:"https://tiles.openfreemap.org/planet")!)
            style.addSource(source)
            let buildings=MLNFillStyleLayer(identifier:"today-buildings",source:source)
            buildings.sourceLayerIdentifier="building";buildings.minimumZoomLevel=12
            buildings.fillColor=NSExpression(forConstantValue:UIColor(red:0.36,green:0.43,blue:0.47,alpha:1))
            buildings.fillOpacity=NSExpression(forConstantValue:0.22)
            let roads=MLNLineStyleLayer(identifier:"today-roads",source:source)
            roads.sourceLayerIdentifier="transportation";roads.minimumZoomLevel=8
            roads.predicate=NSPredicate(format:"class IN {'motorway','trunk','primary','secondary','tertiary','minor','service','path','track'}")
            roads.lineColor=NSExpression(forConstantValue:UIColor(red:0.31,green:0.42,blue:0.49,alpha:1))
            roads.lineOpacity=NSExpression(forConstantValue:0.45)
            let closeWidth:[Any]=["match",["get","class"],"motorway",2.4,"trunk",2.0,"primary",1.6,"secondary",1.2,"tertiary",0.9,"minor",0.65,"service",0.4,0.25]
            roads.lineWidth=NSExpression(mglJSONObject:["interpolate",["linear"],["zoom"],8,0.3,14,closeWidth])
            // Above territorial fills and below historical boundary lines and labels.
            if let anchor=style.layer(withIdentifier:"regions-casing") {
                style.insertLayer(buildings,below:anchor);style.insertLayer(roads,below:anchor)
            } else { style.addLayer(buildings);style.addLayer(roads) }
            let labels=MLNSymbolStyleLayer(identifier:"today-places",source:source)
            labels.sourceLayerIdentifier="place";labels.minimumZoomLevel=9
            labels.predicate=NSPredicate(format:"class IN {'city','town','village','suburb','neighbourhood'}")
            labels.textFontNames=NSExpression(forConstantValue:[AtlasCartography.font])
            labels.textFontSize=NSExpression(forConstantValue:11)
            labels.textColor=NSExpression(forConstantValue:UIColor(red:0.25,green:0.36,blue:0.43,alpha:1))
            labels.textHaloColor=NSExpression(forConstantValue:UIColor(red:0.97,green:0.95,blue:0.91,alpha:1))
            labels.textHaloWidth=NSExpression(forConstantValue:1)
            if let anchor=style.layer(withIdentifier:"region-labels") { style.insertLayer(labels,below:anchor) }
            else { style.addLayer(labels) }
        }
        for id in ["today-roads","today-buildings","today-places"] { style.layer(withIdentifier:id)?.isVisible=enabled }
        (style.layer(withIdentifier:"today-places") as? MLNSymbolStyleLayer)?.text=NSExpression(mglJSONObject:["coalesce",["get",english ? "name:en" : "name:zh"],["get","name"]])
    }
}
