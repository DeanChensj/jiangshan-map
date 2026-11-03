import SwiftUI

struct AtlasEventPeek: View {
    let store: AtlasStore
    let event: AtlasEvent
    let onOpen: ()->Void
    var body: some View {
        HStack(alignment:.top,spacing:10) {
            Button(action:onOpen) {
                HStack(alignment:.top,spacing:10) {
                    Image(systemName:event.major ? "map" : "sparkle").font(.system(size:14)).foregroundStyle(AtlasTheme.vermilion).padding(.top,2)
                    VStack(alignment:.leading,spacing:4) {
                        Text(store.yearLabel(event.year)).font(AtlasFonts.ui(10,weight:.medium)).foregroundStyle(AtlasTheme.vermilion)
                        Text(store.text(event.title,event.titleEn)).font(AtlasFonts.serif(13,weight:.semibold)).lineLimit(2,reservesSpace:true).foregroundStyle(AtlasTheme.ink)
                    }.frame(maxWidth:.infinity,alignment:.leading)
                    Image(systemName:"chevron.right").font(.caption2).foregroundStyle(AtlasTheme.secondary).padding(.top,4)
                }.contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityIdentifier("atlas.event.peek")
            Button { store.autoEventDismissed=true } label:{Image(systemName:"xmark").font(.system(size:10)).frame(width:24,height:24)}.accessibilityLabel(store.text("关闭事件提示","Dismiss event"))
        }.padding(12).background(AtlasTheme.paper,in:RoundedRectangle(cornerRadius:18))
            .overlay { RoundedRectangle(cornerRadius:18).stroke(AtlasTheme.vermilion.opacity(0.13)) }
            .padding(.horizontal,16)
    }
}

struct AtlasJourneyPeek: View {
    let store: AtlasStore
    let onOpen: ()->Void
    var body: some View {
        if let experience=store.experience {
            HStack(spacing:10) {
                Button(action:onOpen) {
                    VStack(alignment:.leading,spacing:3) {
                        Text(experience.title).font(AtlasFonts.serif(14,weight:.semibold)).foregroundStyle(AtlasTheme.vermilion)
                        Text(store.activeStop.map { "\(store.experienceIndex+1)/\(experience.stops.count) · \($0.site)" } ?? store.text("全图总览","Journey overview")).font(AtlasFonts.ui(10)).foregroundStyle(AtlasTheme.secondary)
                    }.frame(maxWidth:.infinity,alignment:.leading)
                }.buttonStyle(.plain).accessibilityIdentifier("atlas.journey.open")
                Button { store.experienceFooterNext() } label:{Image(systemName:"arrow.right").frame(width:32,height:36)}.accessibilityLabel(store.text("下一站","Next stop"))
                Button { store.playing=false;store.experience=nil;store.selection=nil;store.syncMilestone() } label:{Image(systemName:"xmark").font(.caption).frame(width:28,height:36)}.accessibilityLabel(store.text("关闭路线","Close route"))
            }
        }
    }
}
