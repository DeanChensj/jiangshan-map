import Foundation
import CoreLocation

enum AtlasGeometry {
    static func curve(_ points: [[Double]]) -> [CLLocationCoordinate2D] {
        let points=points.filter { $0.count == 2 }
        guard points.count > 1 else { return points.map { .init(latitude:$0[1],longitude:$0[0]) } }
        func project(_ p:[Double])->[Double] { [p[0],log(tan(.pi/4+p[1] * .pi/360))*180 / .pi] }
        let ps=points.map(project);var result:[CLLocationCoordinate2D]=[]
        for i in 0..<ps.count-1 {
            let a=ps[max(0,i-1)],b=ps[i],c=ps[i+1],d=ps[min(ps.count-1,i+2)]
            for step in 0..<8 {
                let t=Double(step)/8,t2=t*t,t3=t2*t
                func blend(_ j:Int)->Double { 0.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t2+(-a[j]+3*b[j]-3*c[j]+d[j])*t3) }
                let x=blend(0),y=blend(1)
                result.append(.init(latitude:(2*atan(exp(y * .pi/180)) - .pi/2)*180 / .pi,longitude:x))
            }
        }
        if let last=points.last { result.append(.init(latitude:last[1],longitude:last[0])) };return result
    }
}
