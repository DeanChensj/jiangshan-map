import SwiftUI

struct AtlasMilestoneCard: View {
    let store: AtlasStore
    let event: AtlasEvent
    var body: some View {
        VStack(alignment:.leading,spacing:8) {
            HStack {
                Text(store.yearLabel(event.year)).font(AtlasFonts.ui(11,weight:.medium)).foregroundStyle(AtlasTheme.vermilion)
                if event.major { Label(store.text("版图变迁","Map change"),systemImage:"map").font(AtlasFonts.ui(10)).foregroundStyle(AtlasTheme.vermilion) }
                Spacer()
                Button { store.autoEventDismissed=true } label:{ Image(systemName:"xmark").font(.caption) }.accessibilityLabel(store.text("关闭事件提示","Dismiss event"))
            }
            Button { store.select(event) } label:{ Text(store.text(event.title,event.titleEn)).font(AtlasFonts.serif(16,weight:.semibold)).multilineTextAlignment(.leading).foregroundStyle(AtlasTheme.ink) }.buttonStyle(.plain)
            HStack {
                Text(store.text(event.site,event.siteEn ?? event.site)).font(AtlasFonts.ui(11)).foregroundStyle(AtlasTheme.secondary).lineLimit(1)
                Spacer()
                if let seal=event.sealStop { Button(store.text("玺 · 传国玺","Seal ›")) { Task { await store.startPeople("yuxi",stop:seal) } }.font(AtlasFonts.ui(11)).tint(AtlasTheme.vermilion) }
            }
            if let anchors=event.anchors,anchors.count > 1 {
                ScrollView(.horizontal){HStack { ForEach(Array(anchors.enumerated()),id:\.offset) { _,anchor in
                    Button(store.text(anchor.title,anchor.titleEn)) { store.fly(anchor.coord,zoom:store.nativeZoom(forWebScale:3.25)) }.font(AtlasFonts.ui(11)).buttonStyle(.bordered)
                } }}.scrollIndicators(.hidden)
            }
        }.padding(14).background(AtlasTheme.paper.opacity(0.97),in:RoundedRectangle(cornerRadius:14))
            .overlay { RoundedRectangle(cornerRadius:14).stroke(AtlasTheme.vermilion.opacity(0.25)) }.padding(.horizontal,14)
    }
}

struct AtlasExperiencePanel: View {
    let store: AtlasStore
    let onOpen: ()->Void
    var body: some View {
        if let experience=store.experience {
            VStack(alignment:.leading,spacing:9) {
                HStack(alignment:.top) {
                    Button(action:onOpen) {
                        VStack(alignment:.leading,spacing:4) {
                            Text(experience.title).font(AtlasFonts.serif(17,weight:.semibold)).foregroundStyle(AtlasTheme.vermilion)
                            if let stop=store.activeStop {
                                Text("\(store.experienceIndex+1)/\(experience.stops.count) · " + stop.site + (stop.encounter ? " × " + store.text("相遇","Encounter") : "")).font(AtlasFonts.ui(12))
                                Text(stop.text).font(AtlasFonts.ui(11)).foregroundStyle(AtlasTheme.secondary).lineLimit(2)
                            } else {
                                Text(store.text("全图总览","Journey overview") + " · \(experience.stops.count) " + store.text("站","stops") + (experience.encounters.isEmpty ? "" : " · \(experience.encounters.count) " + store.text("处相逢","encounters"))).font(AtlasFonts.ui(12))
                                if let profiles=experience.profiles {
                                    Text(profiles.map { person in person.title + (person.span.count == 2 ? " \(person.span[0])—\(person.span[1])" : "") }.joined(separator:" · ")).font(AtlasFonts.ui(10)).foregroundStyle(AtlasTheme.secondary)
                                }
                            }
                        }.multilineTextAlignment(.leading)
                    }.buttonStyle(.plain)
                    Spacer(minLength:4)
                    Button { store.playing=false;store.experience=nil;store.selection=nil;store.syncMilestone() } label:{Image(systemName:"xmark.circle.fill")}.accessibilityLabel(store.text("关闭路线","Close route"))
                }
                HStack {
                    if store.experienceIndex >= 0 { Button(store.text("全图总览","Overview"),systemImage:"map") { store.experienceOverview() } }
                    Spacer()
                    Button(nextLabel(experience),systemImage:"arrow.right") { store.experienceFooterNext() }
                }.font(AtlasFonts.ui(11)).buttonStyle(.borderless)
            }
        }
    }
    private func nextLabel(_ experience: AtlasExperience)->String {
        let next=store.experienceIndex+1
        guard experience.stops.indices.contains(next) else { return store.text("回到总览","Back to overview") }
        return store.text(next == 0 ? "出发 · " : "下一站 · ",next == 0 ? "Start · " : "Next · ") + experience.stops[next].site
    }
}

struct AtlasChronicleRows: View {
    let store: AtlasStore
    var body: some View {
        LazyVStack(alignment:.leading,spacing:14) {
            Text(store.text("编年纪事","CHRONICLE")).font(AtlasFonts.ui(11,weight:.medium)).foregroundStyle(AtlasTheme.secondary)
            ForEach(store.events) { event in
                Button { store.presentEvent(event) } label:{
                    HStack(alignment:.top,spacing:10) {
                        Circle().fill(event.id == store.currentMilestone?.id ? AtlasTheme.vermilion : AtlasTheme.secondary.opacity(0.4)).frame(width:6,height:6).padding(.top,5)
                        VStack(alignment:.leading,spacing:5) {
                            HStack { Text(store.yearLabel(event.year));if event.major { Image(systemName:"map") };if event.sealStop != nil { Text("玺") } }.font(AtlasFonts.ui(11)).foregroundStyle(AtlasTheme.vermilion)
                            Text(store.text(event.title,event.titleEn)).font(AtlasFonts.ui(13)).foregroundStyle(AtlasTheme.ink)
                            Text(store.text(event.site,event.siteEn ?? event.site)).font(AtlasFonts.ui(10)).foregroundStyle(AtlasTheme.secondary)
                        }.frame(maxWidth:.infinity,alignment:.leading)
                    }.padding(7).background(event.id == store.currentMilestone?.id ? AtlasTheme.vermilion.opacity(0.07) : .clear,in:RoundedRectangle(cornerRadius:8))
                }.buttonStyle(.plain).id(event.id)
            }
        }
    }
}

struct AtlasTimelineBands: View {
    let store: AtlasStore
    let onSelect:(Dynasty)->Void
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing:1) {
                let weights=store.timelineWeights,total=weights.reduce(0) { $0+$1.1 }
                ForEach(weights,id:\.0.id) { dynasty,weight in
                    let width=max(1,geometry.size.width*weight/max(1,total)),range=store.timelineBandRange(dynasty)
                    Button { onSelect(dynasty) } label:{
                        ZStack {
                            Rectangle().fill(Color(atlasHex:dynasty.tint).opacity(store.dynasty?.id == dynasty.id ? 0.8 : 0.25))
                            ForEach(dynasty.phases.dropFirst().filter { range.contains($0.from) }) { phase in
                                Rectangle().fill(AtlasTheme.paper.opacity(0.65)).frame(width:1).offset(x:width*CGFloat(phase.from-range.lowerBound)/CGFloat(max(1,range.upperBound-range.lowerBound))-width/2)
                            }
                            if width > 21 { Text(store.text(dynasty.title,dynasty.titleEn)).font(AtlasFonts.ui(8)).lineLimit(1).minimumScaleFactor(0.6).padding(.horizontal,2) }
                            ForEach((store.catalog?.events ?? []).filter { $0.dynasty == dynasty.id && $0.source == "milestone" && range.contains($0.effectiveYear) }) { event in
                                Circle().fill(AtlasTheme.vermilion.opacity(0.65)).frame(width:2,height:2).offset(x:width*CGFloat(event.effectiveYear-range.lowerBound)/CGFloat(max(1,range.upperBound-range.lowerBound))-width/2,y:7)
                            }
                        }.frame(width:max(1,width-1),height:22)
                    }.buttonStyle(.plain).accessibilityLabel(store.text(dynasty.title,dynasty.titleEn))
                }
            }
        }.frame(height:22).clipShape(RoundedRectangle(cornerRadius:4))
    }
}

struct AtlasWelcomeView: View {
    let store: AtlasStore
    let onClose:()->Void
    var body: some View {
        VStack(alignment:.leading,spacing:24) {
            Text(store.localChinese("江山时序")).font(AtlasFonts.title(38))
            Text(store.text("从一座城，读两千年山河。","Discover 2,400 years through a place.")).font(AtlasFonts.serif(23))
            Label(store.text("拖动时间轴，看疆域与河道变迁。","Scrub the timeline to watch borders and rivers change."),systemImage:"clock")
            Label(store.text("轻点都城，或长按任意地点，查看历代沿革。","Tap a capital or touch and hold any place for its history."),systemImage:"mappin.and.ellipse")
            Label(store.text("搜索人物、年号、古今地名；比较同行与相逢。","Search people, eras and places; compare journeys and encounters."),systemImage:"person.2")
            Button(store.text("从一座都城开始","Explore a capital")) { finish();if let city=store.places.first(where:{ $0.isCapital(at:store.year) }) { store.select(city) } }.buttonStyle(.borderedProminent)
            Button(store.text("播放历史时间轴","Play the timeline")) { finish();store.playing=true }.buttonStyle(.bordered)
            Button(store.text("自由浏览","Explore freely")) { finish() }
            Spacer()
        }.font(AtlasFonts.ui(15)).padding(28).navigationTitle(store.text("展开山河","Welcome"))
    }
    private func finish(){ store.dismissOnboarding();onClose() }
}
