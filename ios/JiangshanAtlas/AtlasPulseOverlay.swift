import UIKit
import MapLibre

/// Decorative rings animate in Core Animation only while the camera is idle.
final class AtlasPulseOverlay: UIView {
    private var signature = ""
    override init(frame: CGRect) {
        super.init(frame:frame)
        isUserInteractionEnabled=false
        autoresizingMask=[.flexibleWidth,.flexibleHeight]
        clipsToBounds=true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func update(_ points: [(CGPoint,UIColor)], enabled: Bool) {
        isHidden = !enabled || UIAccessibility.isReduceMotionEnabled
        guard !isHidden else { return }
        let next=points.map { "\(Int($0.0.x)),\(Int($0.0.y)),\($0.1.description)" }.joined(separator:"|")
        guard signature != next else { return };signature=next
        layer.sublayers?.forEach { $0.removeFromSuperlayer() }
        for (position,color) in points where bounds.contains(position) {
            let ring=CAShapeLayer();ring.bounds = .init(x:0,y:0,width:28,height:28);ring.position=position
            ring.path=UIBezierPath(ovalIn:.init(x:1,y:1,width:26,height:26)).cgPath
            ring.fillColor=UIColor.clear.cgColor;ring.strokeColor=color.cgColor;ring.lineWidth=1.3
            ring.opacity=0
            let scale=CABasicAnimation(keyPath:"transform.scale");scale.fromValue=0.58;scale.toValue=1.3
            let opacity=CABasicAnimation(keyPath:"opacity");opacity.fromValue=0.72;opacity.toValue=0
            let group=CAAnimationGroup();group.animations=[scale,opacity];group.duration=2.1;group.repeatCount = .infinity
            group.timingFunction=CAMediaTimingFunction(name:.easeOut)
            layer.addSublayer(ring);ring.add(group,forKey:"breath")
        }
    }
}
