import Foundation

extension AtlasStore {
    func exploreFocusCity(_ city:String) {
        beginNavigation()
        playing=false;selection=nil;historicalDetail=nil;mapNote=nil;experience=nil;journey=nil
        lockPeriod=false;linkYearRange=nil
        showHistoricalDetail=true;showPlaces=true;setYear(750);autoEventDismissed=true
        let sites=focusSites.filter { $0.city == city && $0.isVisible(at:year) }
        guard let first=sites.first else { return }
        let xs=sites.map { $0.coord[0] },ys=sites.map { $0.coord[1] }
        destination = .init(longitude:first.coord[0],latitude:first.coord[1],zoom:9,bounds:[xs.min()!-0.015,ys.min()!-0.015,xs.max()!+0.015,ys.max()!+0.015])
    }
    func selectFocusSite(_ site:AtlasFocusSite,move:Bool=false) {
        playing=false;experience=nil;journey=nil
        if !site.isVisible(at:year) { lockPeriod=false;linkYearRange=nil;setYear(min(site.until,max(site.from,750))) }
        inspect(site.coord,title:text(site.title,site.titleEn))
        mapNote = .init(title:site.title,detail:site.detail+"\n\n唐代专题 · 遗址约略位置，非建筑轮廓。图层年代不代表遗址完整存续期。",sourceURL:URL(string:site.sourceURL),titleEn:site.titleEn,detailEn:site.detailEn+"\n\nTang focus · approximate site marker, not a building footprint. Layer dates do not describe the site's entire lifetime.",focusSiteID:site.id)
        if move { fly(site.coord,zoom:11) }
    }
    var selectionTitle: String {
        if case .coordinate = selection,let id=mapNote?.focusSiteID,let site=focusSites.first(where:{$0.id == id}) { return localChinese(site.name(at:year,english:english)) }
        if case .coordinate = selection, let note=mapNote { return text(note.title,note.titleEn ?? note.title) }
        if case .coordinate = selection, let heading=historicalDetail?.heading, !heading.isEmpty { return heading }
        if case .territory = selection, let detail=polityDetail { return detail.title }
        return localChinese(selection?.title(english:english) ?? "")
    }
    var visibleTrackIDs: Set<String> {
        guard let experience else { return [] }
        guard experienceIndex >= 0, experience.tracks.count > 1 else { return Set(experience.tracks.map(\.id)) }
        let current=activeStop
        var primary=experience.tracks.filter { current?.person.contains($0.title) == true }
        let era=current?.dynastyID ?? dynasty?.id ?? ""
        if primary.isEmpty { primary=experience.tracks.filter { $0.stops.contains { $0.dynastyID == era } } }
        if primary.isEmpty, let nearest=experience.tracks.min(by:{ abs(($0.stops.first?.year ?? year)-year) < abs(($1.stops.first?.year ?? year)-year) }) { primary=[nearest] }
        return Set(experience.tracks.filter { track in
            if primary.contains(where:{ $0.id == track.id }) || track.stops.contains(where:{ $0.dynastyID == era }) { return true }
            let lo=track.stops.map(\.year).min() ?? year, hi=track.stops.map(\.year).max() ?? year
            return primary.contains { p in let a=p.stops.map(\.year).min() ?? year,b=p.stops.map(\.year).max() ?? year;return b+30 >= lo && hi+30 >= a }
        }.map(\.id))
    }
    func fitExperience() {
        guard let experience else { return }
        let visible=visibleTrackIDs
        let coords=experience.tracks.filter { visible.contains($0.id) }.flatMap { $0.stops.flatMap { $0.via+[$0.coord] } }
        fitCoordinates(coords)
    }
    func fitCoordinates(_ coords: [[Double]]) {
        let valid=coords.filter { $0.count == 2 && $0.allSatisfy(\.isFinite) };guard let first=valid.first else { return }
        let xs=valid.map { $0[0] },ys=valid.map { $0[1] }
        var west=xs.min()!,east=xs.max()!,south=ys.min()!,north=ys.max()!
        if east-west < 1 { west -= 0.5;east += 0.5 };if north-south < 1 { south -= 0.5;north += 0.5 }
        destination = .init(longitude:first[0],latitude:first[1],zoom:3,bounds:[west,south,east,north])
    }
    func experienceOverview() {
        playing=false;selection=nil;historicalDetail=nil;experienceIndex = -1;routeRevision += 1;fitExperience()
    }
    func experienceFooterNext() {
        guard let experience else { return }
        if experienceIndex+1 >= experience.stops.count { experienceOverview() }
        else { experienceIndex += 1;showExperienceStop() }
    }
    func fitPolity(_ title: String) {
        if let entry=mapPolities.first(where:{ ($0.title == title || polityDetail?.titles.contains($0.title) == true) && $0.id.hasPrefix(phase?.id ?? "\0") }), let bounds=entry.bounds {
            destination = .init(longitude:entry.coord[0],latitude:entry.coord[1],zoom:3,bounds:bounds);pendingPolityFit=nil
        } else { pendingPolityFit=title }
    }
    func closePolity() { beginNavigation();pendingPolityFit=nil;focusedPolity="";polityDetail=nil;previewSnapshot=nil;selection=nil;resetCamera() }
    func dismissOnboarding() { onboarding=false;preferences.set(true,forKey:"atlas.guided") }
    func openGenealogyEvent(_ event: GenealogyEvent) {
        playing=false
        if let match=catalog?.events.first(where:{ $0.year == event.year && (text($0.title,$0.titleEn) == event.title || $0.title == event.title) }) { presentEvent(match) }
        else { setYear(event.year);fly(event.coord,zoom:nativeZoom(forWebScale:3.25)) }
    }
}
