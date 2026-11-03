import Foundation

extension AtlasStore {
    var timelineStart: Int { max(minYear,linkYearRange?.lowerBound ?? minYear) }
    var timelineEnd: Int { min(maxYear,linkYearRange?.upperBound ?? maxYear) }
    func timelineBandRange(_ dynasty: Dynasty) -> ClosedRange<Int> {
        max(timelineStart,dynasty.from)...max(max(timelineStart,dynasty.from),min(timelineEnd,dynasty.to))
    }
    var timelineNodeYears: [Int] {
        var years = [minYear,maxYear]
        for dynasty in catalog?.dynasties ?? [] { years += [dynasty.from,dynasty.focus]; years += dynasty.phases.map(\.from) }
        years += (catalog?.events ?? []).filter { $0.source == "milestone" }.map(\.effectiveYear)
        return Array(Set(years + [timelineStart,timelineEnd])).filter { $0 >= timelineStart && $0 <= timelineEnd }.sorted()
    }
    var timelineWeights: [(Dynasty,Double)] {
        (catalog?.dynasties ?? []).filter { $0.to >= timelineStart && $0.from <= timelineEnd }.map {
            let range=timelineBandRange($0)
            return ($0,Double(max(60,$0.to-$0.from+1))*Double(range.upperBound-range.lowerBound+1)/Double($0.to-$0.from+1))
        }
    }
    func timelineProgress(_ target: Int) -> Double {
        let weights=timelineWeights, total=weights.reduce(0) { $0+$1.1 };var offset=0.0
        for (d,w) in weights {
            let range=timelineBandRange(d)
            if target <= range.upperBound {
                if target >= timelineEnd { return 1 }
                return min(1,max(0,(offset+w*Double(max(0,target-range.lowerBound))/Double(range.upperBound-range.lowerBound+1))/max(1,total)))
            }
            offset += w
        };return 1
    }
    func year(atProgress progress: Double) -> Int {
        let weights=timelineWeights,total=weights.reduce(0) { $0+$1.1 };var left=min(1,max(0,progress))*total
        for (d,w) in weights {
            let range=timelineBandRange(d)
            if left < w-1e-9 {
                let fraction=max(0,left)/max(0.001,w)
                let value=min(range.upperBound,range.lowerBound+Int(floor(fraction*Double(range.upperBound-range.lowerBound+1)+1e-9)))
                return value == 0 ? (range.upperBound >= 1 ? 1 : -1) : value
            }
            left -= w
        };return timelineEnd
    }
    var currentMilestone: AtlasEvent? {
        let list=events.filter { $0.source == "milestone" && $0.effectiveYear <= year }
        if let active=list.first(where:{ $0.id == activeEventID && $0.effectiveYear == year }) { return active }
        return list.last
    }
    func syncMilestone() {
        guard experience == nil, journey == nil, quiz == nil else { autoEvent=nil;return }
        let event=currentMilestone
        if autoEvent?.id != event?.id { autoEventDismissed=false;autoEvent=event }
    }
    func stepSameYearEvent(_ direction: Int) -> Bool {
        let matches=events.filter { $0.source == "milestone" && $0.effectiveYear == year }
        guard matches.count > 1 else { return false }
        let index=matches.firstIndex { $0.id == (activeEventID ?? currentMilestone?.id) } ?? 0
        let next=index+direction
        guard matches.indices.contains(next) else { return false }
        activeEventID=matches[next].id;autoEvent=matches[next];autoEventDismissed=false
        frameMilestone(matches[next]);return true
    }
    func frameMilestone(_ event: AtlasEvent, automatic:Bool=false) {
        guard Self.validCoordinate(event.coord) else { return }
        if automatic && (isGestureActive || Date() < cameraInteractionUntil) { return }
        if !automatic { isGestureActive=false;cameraInteractionUntil = .distantPast }
        if event.major && !playing { resetCamera() }
        else {
            var target=CameraDestination(longitude:event.coord[0],latitude:event.coord[1],zoom:cameraZoom)
            target.ensureVisible=true;destination=target
        }
    }
    func playbackTick() -> Bool {
        guard !mapStageLoading, Date() >= mapTransitionUntil else { return true }
        if experience != nil {
            guard let experience, experienceIndex+1 < experience.stops.count else { return false }
            stepExperience(1);return true
        }
        if playbackHold > 0 { playbackHold -= 1;return true }
        guard year < timelineEnd, !lockPeriod || year < (dynasty?.to ?? timelineEnd) else { return false }
        let delta=280.0/(9*60*1000), previousPhase=phase?.id
        playbackShown += 1;playbackProgress += delta
        var next=year(atProgress:playbackProgress)
        guard next > year else { return true }
        if let stop=catalog?.playbackStops.first(where:{ $0.year > year && $0.year <= next }) {
            if playbackShown < 4 { playbackProgress -= delta;return true }
            next=stop.year;playbackShown=stop.hold ? 4 : 0
            if stop.hold { playbackHold=9 }
        }
        let previousID=autoEvent?.id
        setYear(next)
        if phase?.id != previousPhase, !isGestureActive, Date() >= cameraInteractionUntil { resetCamera() }
        else if previousID != autoEvent?.id, let event=autoEvent { frameMilestone(event,automatic:true) }
        return true
    }
    var playbackInterval: Int { Int((experience == nil ? 280.0 : 2600.0)/playbackSpeed) }
    func nativeZoom(forWebScale scale: Double) -> Double { max(1,min(14,log2(scale*360*cameraViewportWidth/(76*512)))) }
    func presentEvent(_ event: AtlasEvent, navigation:Int? = nil) {
        let request=navigation ?? beginNavigation()
        guard isCurrentNavigation(request) else { return }
        playing=false;experience=nil;journey=nil;quiz=nil;focusedPolity="";polityDetail=nil;pendingPolityFit=nil
        lockPeriod=false;linkYearRange=nil;activeEventID=event.id
        setYear(event.effectiveYear);autoEvent=event;autoEventDismissed=false
        selection = .event(event);refreshDetail()
        frameMilestone(event)
    }
}
