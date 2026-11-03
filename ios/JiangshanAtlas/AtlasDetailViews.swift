import SwiftUI

struct AtlasInspector: View {
    let store: AtlasStore
    let onSelect: (AtlasSelection) -> Void
    @State private var eventsOnly = false
    @State private var expanded: Set<String> = []

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 20) {
            if let selection = store.selection {
                HStack {
                    Label(store.text("点地溯源", "PLACE & HISTORY"), systemImage: "mappin.and.ellipse").font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion)
                    Spacer()
                    Button { store.selection = nil; store.historicalDetail = nil; store.polityDetail = nil } label: { Image(systemName: "xmark.circle.fill") }.accessibilityLabel(store.text("取消选择", "Clear selection"))
                }
                Text(store.selectionTitle).font(AtlasFonts.serif(29, weight: .medium)).accessibilityIdentifier("atlas.selection.title")
                if store.experience != nil {
                    Button(store.text("返回人物行迹","Return to journey"),systemImage:"arrow.uturn.backward") { store.selection=nil;store.historicalDetail=nil;store.showExperienceStop() }.font(AtlasFonts.ui(12))
                }
                if case .place(let place) = selection {
                    Text(store.text("今 ", "Today: ") + store.text(place.modern, place.modernEn)).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.secondary)
                    if !place.remark.isEmpty { Text(store.text(place.remark, place.remarkEn)).font(AtlasFonts.ui(15)).lineSpacing(5) }
                }
                if case .event(let event) = selection {
                    Text(store.yearLabel(event.year) + " · " + store.localChinese(store.text(event.site,event.siteEn ?? event.site))).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.vermilion)
                    Button(store.text("回到事件发生年", "Show event year")) { store.select(event) }.buttonStyle(.bordered)
                    if let seal=event.sealStop {
                        Button(store.text("追随传国玺行迹","Follow the Imperial Seal"),systemImage:"seal") { Task { await store.startPeople("yuxi",stop:seal) } }.buttonStyle(.bordered).accessibilityIdentifier("atlas.event.imperial-seal")
                    }
                    if let anchors=event.anchors,!anchors.isEmpty {
                        ForEach(Array(anchors.enumerated()),id:\.offset) { index,anchor in
                            Button(store.text(anchor.title,anchor.titleEn),systemImage:"mappin") { store.fly(anchor.coord,zoom:store.nativeZoom(forWebScale:3.25)) }.accessibilityIdentifier("atlas.event.anchor.\(index)")
                        }
                    } else {
                        ForEach(Array((event.coords ?? []).enumerated()), id: \.offset) { i, coord in
                            Button(store.text("地点 \(i + 1)", "Location \(i + 1)"), systemImage: "mappin") { store.fly(coord, zoom: 6) }
                        }
                    }
                }
                if let note = store.mapNote {
                    Text(store.text(note.detail,note.detailEn ?? note.detail)).font(AtlasFonts.ui(15)).lineSpacing(5)
                    if let url=note.sourceURL { Link(store.text("查看史料来源","Historical source"),destination:url).font(AtlasFonts.ui(13)) }
                }
                if let coord = store.selectedCoordinate {
                    Text(String(format: "%.3f°E · %.3f°N", coord[0], coord[1])).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                    if let pass = store.catalog?.passes.first(where: { abs($0.coord[0]-coord[0]) < 0.02 && abs($0.coord[1]-coord[1]) < 0.02 }) {
                        Label(store.text(pass.rangeZh, pass.rangeEn), systemImage: "mountain.2").font(AtlasFonts.ui(17))
                        Text(store.text(pass.chokepointZh, pass.chokepointEn)).font(AtlasFonts.ui(15)).lineSpacing(5)
                        Text(store.text(pass.modernZh, pass.modernEn)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                    }
                    if let detail = store.historicalDetail {
                        Text(detail.info.era).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.vermilion)
                        Text(([detail.info.polity ?? ""] + detail.info.regions + detail.info.prefectures).filter { !$0.isEmpty }.joined(separator: " · ")).font(AtlasFonts.ui(15))
                        if let city = detail.info.nearestCity {
                            Text(store.text("附近城邑：", "Nearest settlement: ") + city.ancient + " · \(city.distanceKm) km").font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                        }
                        if let lore = detail.info.lore {
                            Text(lore.tag).font(AtlasFonts.serif(17)).foregroundStyle(AtlasTheme.vermilion)
                            Text(lore.desc).font(AtlasFonts.ui(15)).lineSpacing(5)
                        }
                        Text(store.text("历 \(detail.rows.count) 朝 · \(detail.rows.flatMap(\.events).count) 处史事 · \(detail.rows.filter(\.capital).count) 朝建都","\(detail.rows.count) eras · \(detail.rows.flatMap(\.events).count) events · capital in \(detail.rows.filter(\.capital).count) eras")).font(AtlasFonts.ui(11)).foregroundStyle(AtlasTheme.secondary)
                        Divider()
                        Toggle(store.text("仅看有史事的时代", "Only eras with recorded events"), isOn: $eventsOnly).font(AtlasFonts.ui(15))
                        Text(store.text("历代行政沿革", "ADMINISTRATIVE GENEALOGY")).font(AtlasFonts.ui(12, weight: .semibold)).foregroundStyle(AtlasTheme.secondary)
                        ForEach(detail.rows.filter { !eventsOnly || !$0.events.isEmpty }) { row in
                            DisclosureGroup(isExpanded:Binding(get:{ expanded.contains(row.id) },set:{ if $0 { expanded.insert(row.id) } else { expanded.remove(row.id) } })) {
                                ForEach(row.events) { event in
                                    Button {
                                        store.openGenealogyEvent(event)
                                    } label: {
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(store.yearLabel(event.year)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion)
                                            Text(event.title).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.ink).multilineTextAlignment(.leading)
                                        }.padding(.vertical, 5)
                                    }
                                }
                                if row.events.isEmpty { Text(store.text("此地暂无收录史事", "No recorded events at this location")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) }
                                Button(store.text("查看此时代", "Show this era")) { store.setYear(row.year) }.font(AtlasFonts.ui(15)).padding(.top, 4)
                            } label: {
                                VStack(alignment: .leading, spacing: 5) {
                                    HStack { Text(row.title).font(AtlasFonts.ui(15, weight: .semibold)); if row.capital { Image(systemName: "building.columns").foregroundStyle(AtlasTheme.vermilion) }; Spacer(); Text("\(row.events.count)").font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) }
                                    Text([row.polity,row.admins,row.place].filter { !$0.isEmpty }.joined(separator: " · ")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                                }
                            }.tint(AtlasTheme.vermilion).padding(8).background(row.id == store.dynasty?.id ? AtlasTheme.vermilion.opacity(0.06) : .clear,in:RoundedRectangle(cornerRadius:8)).id(row.id)
                            Divider()
                        }
                    } else { ProgressView(store.text("查阅历代史料…", "Looking up historical records…")) }
                }
                if case .territory = selection {
                    Button(store.text("返回时代全景","Return to era overview"),systemImage:"arrow.uturn.backward") { store.closePolity() }
                    if let detail = store.polityDetail {
                        Text(store.yearLabel(detail.from) + " — " + store.yearLabel(detail.to)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                        if detail.summary.isEmpty { periodSummary } else { Text(detail.summary).font(AtlasFonts.ui(15)).lineSpacing(6) }
                        Label(detail.seat, systemImage: "building.columns").font(AtlasFonts.ui(15))
                        Text(detail.rulers).font(AtlasFonts.ui(15)).lineSpacing(5)
                        DisclosureGroup(store.text("疆域阶段", "Territorial stages")) {
                            ForEach(detail.stages) { stage in
                                Button { store.previewSnapshot=nil;store.setYear(max(stage.from,detail.from));store.focusedPolity=stage.rawTitle ?? stage.title;store.fitPolity(stage.rawTitle ?? stage.title) } label: {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(store.yearLabel(stage.from) + " — " + store.yearLabel(stage.to)).font(AtlasFonts.ui(15))
                                        if !stage.caption.isEmpty { Text(stage.caption).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) }
                                    }.padding(.vertical, 4)
                                }.padding(6).background(store.phase?.id == stage.snapKey ? AtlasTheme.vermilion.opacity(0.08) : .clear,in:RoundedRectangle(cornerRadius:6)).contextMenu { Button(store.text("预览此期疆域","Preview these boundaries")) { store.previewSnapshot=stage.snapKey } }
                            }
                        }
                        if store.previewSnapshot != nil { Button(store.text("关闭疆域预览","Close boundary preview")) { store.previewSnapshot=nil } }
                        DisclosureGroup(store.text("相关史事", "Related events")) {
                            ForEach(detail.events) { event in
                                Button { if let match=store.catalog?.events.first(where:{ $0.year == event.year && ($0.title == event.title || store.text($0.title,$0.titleEn) == event.title) }) { store.presentEvent(match) } else { store.setYear(event.year);if let coord=event.coord { store.fly(coord,zoom:store.nativeZoom(forWebScale:3.25)) } } } label: {
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(store.yearLabel(event.year)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion)
                                        Text(event.title).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.ink).multilineTextAlignment(.leading)
                                    }.padding(.vertical, 4)
                                }
                            }
                        }
                    } else { periodSummary }
                    Button(store.focusedPolity.isEmpty ? store.text("聚焦此政权", "Focus polity") : store.text("显示全部政权", "Show all polities")) { store.selectTerritory(selection.title(english: false)) }.buttonStyle(.bordered)
                }
                HStack { Button(store.text("收藏", "Bookmark"), systemImage: "bookmark") { store.saveBookmark() }; Spacer(); ShareLink(item: store.shareURL) { Label(store.text("分享", "Share"), systemImage: "square.and.arrow.up") } }.font(AtlasFonts.ui(15))
            } else {
                Text(store.text("山河之间，皆是往事", "Every place holds a story")).font(AtlasFonts.serif(23, weight: .medium))
                Text(store.text("轻点城邑与疆域；长按任意地点查看历代沿革。", "Tap a city or territory. Touch and hold any location for its history.")).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.secondary)
                periodSummary
            }
        }.frame(maxWidth:.infinity,alignment:.leading)
        .onAppear { if let id=store.dynasty?.id { expanded.insert(id) } }
        .onChange(of:store.dynasty?.id) { _,id in if let id { expanded.insert(id) } }
        .onChange(of:store.selection?.id) { _,_ in eventsOnly=false }
    }
    @ViewBuilder private var periodSummary: some View {
        if let dynasty = store.dynasty {
            Text(store.text(dynasty.title, dynasty.titleEn)).font(AtlasFonts.serif(22))
            Text(store.yearLabel(dynasty.from) + " — " + store.yearLabel(dynasty.to)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
            Text(store.text(dynasty.summary, dynasty.summaryEn)).font(AtlasFonts.ui(15)).lineSpacing(6)
            if let overview = store.phase?.overview, !overview.isEmpty, !store.english { Text(store.localChinese(overview)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) }
        }
    }
}

struct AtlasSearchView: View {
    let store: AtlasStore
    let onClose: () -> Void
    @State private var query = ""
    @State private var hits: [SearchHit] = []
    @State private var loading = false
    @State private var error: String?
    private var focusHits:[AtlasFocusSite] {
        store.focusSites.filter { query.isEmpty || ($0.searchText+AtlasChinese.traditional($0.searchText)).localizedStandardContains(query) }
    }
    var body: some View {
        List {
            if query.isEmpty {
                Section(store.text("试试这些", "Try searching")) {
                    ForEach(["长安", "苏轼", "李白 杜甫", "开元", "函谷关", "南诏", "赤壁"], id: \.self) { example in Button(store.localChinese(example)) { query = example } }
                }
                Section(store.text("当代都城", "Capitals in this era")) {
                    ForEach(store.places.filter { $0.isCapital(at: store.year) }) { place in
                        Button(store.text(place.title, place.titleEn)) { onClose(); store.select(place) }
                    }
                }
            }
            if loading { ProgressView().frame(maxWidth: .infinity) }
            ForEach(["changan","luoyang"],id:\.self) { city in
                let sites=focusHits.filter { $0.city == city }
                if !sites.isEmpty {
                    Section(store.text(city == "changan" ? "唐长安 · 宫苑与寺院" : "唐洛阳 · 城门与寺窟",city == "changan" ? "Tang Chang’an · palaces & temples" : "Tang Luoyang · gates & sacred sites")) {
                        ForEach(sites) { site in
                            Button { onClose();store.selectFocusSite(site,move:true) } label:{
                                HStack(spacing:12) {
                                    Image(systemName:site.kind == "palace" ? "building.columns" : site.kind == "gate" ? "door.left.hand.open" : "mappin").frame(width:22).foregroundStyle(AtlasTheme.vermilion).accessibilityHidden(true)
                                    VStack(alignment:.leading,spacing:4) {
                                        Text(store.localChinese(site.name(at:store.year,english:store.english)))
                                        Text(store.yearLabel(site.from)+" — "+store.yearLabel(site.until)).font(AtlasFonts.ui(11)).foregroundStyle(AtlasTheme.secondary)
                                    }
                                    Spacer()
                                    Image(systemName:site.isVisible(at:store.year) ? "circle.fill" : "clock").font(.system(size:8)).foregroundStyle(AtlasTheme.secondary).accessibilityHidden(true)
                                }.padding(.vertical,3)
                            }.accessibilityHint(site.isVisible(at:store.year) ? store.text("在地图上查看","Locate on the map") : store.text("切换至遗址对应年代并定位","Switch to an available year and locate the site"))
                        }
                    }
                }
            }
            if let error { Text(error).font(AtlasFonts.ui(12)).foregroundStyle(.red) }
            ForEach(hits) { hit in
                Button {
                    onClose()
                    Task { await store.handle(hit) }
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: icon(hit.kind)).foregroundStyle(AtlasTheme.vermilion).frame(width: 22)
                        VStack(alignment: .leading, spacing: 5) {
                            HStack { Text(hit.title).foregroundStyle(AtlasTheme.ink);Spacer();Text(kindLabel(hit.kind)).font(AtlasFonts.ui(10)).foregroundStyle(AtlasTheme.vermilion).padding(.horizontal,5).padding(.vertical,2).background(AtlasTheme.vermilion.opacity(0.08),in:Capsule()) }
                            Text(hit.subtitle).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                        }
                    }.padding(.vertical, 5)
                }
            }
            if !loading && !query.isEmpty && hits.isEmpty && focusHits.isEmpty && error == nil { ContentUnavailableView.search(text: query) }
        }
        .scrollContentBackground(.hidden).navigationTitle(store.text("寻古问今", "Explore the atlas"))
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: store.text("城邑、人物、君主、年号、战役…", "Places, people, rulers, eras, battles…"))
        .textInputAutocapitalization(.never).autocorrectionDisabled()
        .task(id: query + store.language) {
            guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { hits = []; loading=false;error=nil;return }
            loading = true; error = nil
            do {
                try await Task.sleep(for: .milliseconds(180))
                let results: [SearchHit] = try await store.engine.query("search", store.arguments(["query": query]))
                guard !Task.isCancelled else { return }; hits = results; loading = false
            } catch is CancellationError { }
            catch { if !Task.isCancelled { self.error = error.localizedDescription; loading = false } }
        }
    }
    private func kindLabel(_ kind:String)->String {
        switch kind { case "person","multi_person":store.text("人物","Person");case "era":store.text("年号","Reign");case "dynasty":store.text("朝代","Era");case "event":store.text("史事","Event");case "polity":store.text("政权","Polity");case "prefecture","region":store.text("政区","Region");case "pass":store.text("关隘","Pass");case "quiz":store.text("挑战","Challenge");default:store.text("地点","Place") }
    }
    private func icon(_ kind: String) -> String {
        switch kind { case "person", "multi_person": "person.2"; case "era", "dynasty": "calendar"; case "event": "flag"; case "polity": "flag.2.crossed"; default: "mappin.and.ellipse" }
    }
}

struct AtlasAboutView: View {
    let store: AtlasStore
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text(store.localChinese("江山时序")).font(AtlasFonts.title(38)).tracking(4)
                Text("CHRONICLES OF THE REALM").font(AtlasFonts.ui(12)).tracking(2).foregroundStyle(AtlasTheme.secondary)
                Text(store.text("两千四百年，山河入掌。", "2,400 years of history, in your hands.")).font(AtlasFonts.serif(20))
                Text(store.text("地图与历史内容随应用提供，支持离线浏览。疆域与州郡边界为历史示意性近似。长按地图可查看任意地点的沿革。古琴音乐需要联网播放。", "Maps and historical content are bundled for offline exploration. Historical boundaries are schematic approximations. Touch and hold the map to explore any location through time. Music requires an internet connection.")).font(AtlasFonts.ui(15)).lineSpacing(6)
                Link(store.text("原项目与史料说明", "Source project & historical references"), destination: URL(string: "https://github.com/DeanChensj/jiangshan-map")!)
                Text("Cartography · MapLibre Native\nHistorical data · Jiangshan Atlas, CHGIS & Hartwell").font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                Text((try? String(contentsOf: AtlasResources.url("NOTICE.txt"), encoding: .utf8)) ?? "").font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                DisclosureGroup(store.text("开源许可", "Open-source license")) { Text((try? String(contentsOf: AtlasResources.url("LICENSE.txt"), encoding: .utf8)) ?? "").font(.system(size: 10, design: .monospaced)).textSelection(.enabled) }
            }.padding(28)
        }.navigationTitle(store.text("关于", "About"))
    }
}
