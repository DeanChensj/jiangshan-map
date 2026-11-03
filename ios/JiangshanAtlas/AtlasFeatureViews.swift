import SwiftUI

struct AtlasPeopleView: View {
    let store: AtlasStore
    let onClose: () -> Void
    @State private var query = ""
    @State private var selected: [String] = []
    private var filteredPeople:[PersonProfile] {
        (store.catalog?.people ?? []).filter { $0.matches(query) }
    }
    var body: some View {
        List {
            Section {
                Text(store.text("选择一至四位人物，比较行迹与同时同地的相遇。君主、别名和年号也可通过全局搜索查找。", "Choose one to four people to compare journeys and encounters. Use global search for rulers, aliases and era names.")).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.secondary)
            }
            Section(store.text("人物", "People")) {
                ForEach(filteredPeople) { person in
                    Button {
                        if selected.contains(person.id) { selected.removeAll { $0 == person.id } }
                        else if selected.count < 4 { selected.append(person.id) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(store.text(person.zh, person.en)).foregroundStyle(AtlasTheme.ink)
                                Text(store.text(person.courtesyZh ?? "", person.courtesyEn ?? "")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                            }
                            Spacer(); Image(systemName: selected.contains(person.id) ? "checkmark.circle.fill" : "circle").foregroundStyle(AtlasTheme.vermilion)
                        }.padding(.vertical, 3)
                    }
                }
            }
            if query.isEmpty {
                Section(store.text("精选旅程", "Curated journeys")) {
                    ForEach(store.catalog?.journeys ?? []) { journey in
                        Button { store.startJourney(journey); onClose() } label: { VStack(alignment: .leading, spacing: 5) { Text(store.text(journey.title, journey.titleEn)); Text("\(journey.stops.count) " + store.text("站", "stops")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) } }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden).navigationTitle(store.text("人物与同行", "People & encounters"))
        .searchable(text: $query, prompt: store.text("人物或别名", "Person or alias"))
        .safeAreaInset(edge: .bottom) {
            Button { let people = selected.joined(separator: ","); onClose(); Task { await store.startPeople(people) } } label: {
                Text(selected.count > 1 ? store.text("比较 \(selected.count) 人行迹", "Compare \(selected.count) people") : store.text("展开人物行迹", "Open person’s journey")).frame(maxWidth: .infinity).padding(8)
            }.buttonStyle(.borderedProminent).disabled(selected.isEmpty).padding().background(AtlasTheme.paper)
        }
    }
}

struct AtlasRouteView: View {
    let store: AtlasStore
    let onClose: () -> Void
    @State private var places = ""
    @State private var years = ""
    @State private var link = ""
    var body: some View {
        Form {
            Section(store.text("地点", "Places")) {
                TextField(store.text("长安, 洛阳, 金陵", "Chang’an, Luoyang, Jinling"), text: $places, axis: .vertical).lineLimit(3...6)
                Text(store.text("逗号分隔沿途地点；分号分隔多条路线。可使用古名、今名或别名。", "Separate stops with commas and parallel routes with semicolons. Historical names, modern names and aliases are supported.")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
            }
            Section(store.text("年份", "Years")) {
                TextField(String(store.year), text: $years).keyboardType(.numbersAndPunctuation)
                Text(store.text("一个年份适用于全程；也可逐站填写年份，例如 744, 745, 746。公元前年份用负数。", "Use one year for the whole route or one per stop, e.g. 744, 745, 746. Negative years indicate BCE.")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
            }
            Button(store.text("绘制路线", "Draw route"), systemImage: "point.topleft.down.to.point.bottomright.curvepath") {
                Task { if await store.startRoute(places, years: years.isEmpty ? String(store.year) : years) { onClose() } }
            }.disabled(places.isEmpty || store.busy)
            Section(store.text("打开网页分享链接", "Open a web atlas link")) {
                TextField("https://…", text: $link).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                Button(store.text("打开链接", "Open link")) {
                    if let url = URL(string: link.trimmingCharacters(in: .whitespacesAndNewlines)) { onClose(); store.open(url) }
                }.disabled(link.isEmpty)
            }
            Section(store.text("例子", "Example")) {
                Button(store.text("唐代长安—洛阳—金陵", "Tang: Chang’an—Luoyang—Jinling")) { places = "长安,洛阳,金陵"; years = "750" }
                Button(store.text("两路会于洛阳", "Two routes meeting at Luoyang")) { places = "长安,洛阳;金陵,洛阳"; years = "744" }
            }
        }.scrollContentBackground(.hidden).navigationTitle(store.text("自定义路线", "Custom routes"))
        .onAppear { places = store.experience?.place ?? ""; years = store.experience?.years ?? "" }
    }
}

struct AtlasChronicleView: View {
    let store: AtlasStore
    private var encountersOnly: Bool { get { store.encountersOnly } nonmutating set { store.encountersOnly=newValue } }
    var body: some View {
        ScrollViewReader { proxy in
        List {
            if let experience = store.experience {
                Section {
                    Text(experience.title).font(AtlasFonts.serif(22))
                    Text(experience.subtitle).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.secondary)
                    Button(store.text("全图总览","Journey overview"),systemImage:"map") { store.experienceOverview() }
                    if let profiles=experience.profiles { ForEach(profiles) { person in
                        Text(person.title + (person.span.count == 2 ? " · " + store.yearLabel(person.span[0]) + " — " + store.yearLabel(person.span[1]) : "")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                    } }
                    if let eras=experience.eraCount { Text(store.text("历 \(eras) 朝 · 共 \(experience.stops.count) 站","\(eras) eras · \(experience.stops.count) stops")).font(AtlasFonts.ui(12)) }
                    if experience.distance > 0 { Text(String(format: "%.0f km", experience.distance)).font(AtlasFonts.ui(12)) }
                    if experience.tracks.count > 1 {
                        ForEach(experience.tracks) { track in Label { Text(track.title) } icon: { Circle().fill(Color(atlasHex: track.color)).frame(width: 9, height: 9) }.font(AtlasFonts.ui(15)) }
                        if experience.kind == "person" { Toggle(store.text("仅看同时同地相遇", "Only contemporary encounters"), isOn:Binding(get:{encountersOnly},set:{encountersOnly=$0})) }
                    }
                }
                ForEach(Array(experience.stops.enumerated()).filter { !encountersOnly || $0.element.encounter }, id: \.element.id) { index, stop in
                    Section {
                        Button { store.experienceIndex = index; store.showExperienceStop() } label: {
                            HStack {
                                Circle().fill(Color(atlasHex: stop.color)).frame(width: 8, height: 8)
                                Text(store.yearLabel(stop.year) + " · " + stop.site).font(AtlasFonts.ui(17))
                                Spacer(); if store.experienceIndex == index { Image(systemName: "location.fill") }
                            }
                        }
                        if !stop.person.isEmpty { Text(stop.person).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion) }
                        if stop.encounter { Label(store.text("同时同地的相遇", "Contemporary encounter"), systemImage: "person.2.fill").font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion) }
                        if !stop.modern.isEmpty { Text(store.text("今 ", "Today: ") + stop.modern).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) }
                        if let notes=stop.notes,notes.count > 1 {
                            ForEach(Array(notes.enumerated()),id:\.offset) { _,note in
                                VStack(alignment:.leading,spacing:4) { Text(note.person).font(AtlasFonts.ui(11,weight:.medium)).foregroundStyle(Color(atlasHex:note.color));Text(note.text).font(AtlasFonts.ui(15)).lineSpacing(5) }
                            }
                        } else { Text(stop.text).font(AtlasFonts.ui(15)).lineSpacing(5) }
                        if !stop.quote.isEmpty { Text(stop.quote).font(AtlasFonts.serif(15)).foregroundStyle(AtlasTheme.secondary).lineSpacing(5).textSelection(.enabled) }
                        Button(store.text("查看此地沿革", "Explore this place’s history"), systemImage: "mappin.and.ellipse") { store.inspect(stop.coord, title: stop.site) }
                    }.id(stop.id).listRowBackground(store.experienceIndex == index ? AtlasTheme.vermilion.opacity(0.06) : AtlasTheme.paper)
                }
                if encountersOnly && experience.encounters.isEmpty { Text(store.text("未收录可核实的同时同地相遇。", "No contemporary encounters recorded.")).foregroundStyle(AtlasTheme.secondary) }
            } else if let journey = store.journey {
                ForEach(Array(journey.stops.enumerated()), id: \.element.id) { index, stop in
                    Section {
                        Button(store.yearLabel(stop.year) + " · " + store.text(stop.title, stop.titleEn)) { store.journeyIndex = index; store.setYear(stop.year); store.fly(stop.coord, zoom: 5) }
                        Text(store.text(stop.detail, stop.detailEn)).font(AtlasFonts.ui(15)).lineSpacing(5)
                        if !stop.quote.isEmpty { Text(store.text(stop.quote, stop.quoteEn)).font(AtlasFonts.serif(15)).foregroundStyle(AtlasTheme.secondary).textSelection(.enabled) }
                    }
                }
            } else {
                if let dynasty = store.dynasty {
                    Section(store.text(dynasty.title, dynasty.titleEn)) { Text(store.text(dynasty.summary, dynasty.summaryEn)).font(AtlasFonts.ui(15)).lineSpacing(5) }
                }
                ForEach(store.events) { event in
                    Button { store.presentEvent(event) } label: {
                        VStack(alignment: .leading, spacing: 7) {
                            HStack { Text(store.yearLabel(event.year));if event.major { Label(store.text("版图","Map"),systemImage:"map") };if event.sealStop != nil { Text("玺") } }.font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion)
                            Text(store.text(event.title, event.titleEn)).font(AtlasFonts.ui(15)).foregroundStyle(AtlasTheme.ink)
                            Text(store.text(event.site,event.siteEn ?? event.site)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                        }.padding(.vertical, 5)
                    }.id(event.id).listRowBackground(event.id == store.currentMilestone?.id ? AtlasTheme.vermilion.opacity(0.07) : AtlasTheme.paper)
                }
            }
        }.scrollContentBackground(.hidden).navigationTitle(store.text("编年纪事", "Chronicle"))
        .onAppear { scroll(proxy) }
        .onChange(of:store.experienceIndex) { _,_ in withAnimation { scroll(proxy) } }
        .onChange(of:store.currentMilestone?.id) { _,_ in if store.experience == nil { withAnimation { scroll(proxy) } } }
        }
    }
    private func scroll(_ proxy:ScrollViewProxy) {
        if let stop=store.activeStop { proxy.scrollTo(stop.id,anchor:.center) }
        else if store.experience == nil,let event=store.currentMilestone { proxy.scrollTo(event.id,anchor:.center) }
    }
}

struct AtlasOptionsView: View {
    @Bindable var store: AtlasStore
    var body: some View {
        Form {
            Section(store.text("历史舆图", "Historical map")) {
                Toggle(store.text("历史疆域", "Historical territories"), isOn: $store.showTerritories)
                Toggle(store.text("州郡边界", "Administrative boundaries"), isOn: $store.showBoundaries)
                Toggle(store.text("古地名", "Historical settlements"), isOn: $store.showPlaces)
                Toggle(store.text("放大细节 · 州郡名与历史遗址", "Close-up prefectures & historical sites"), isOn:$store.showHistoricalDetail)
                Toggle(store.text("关河丝路", "Passes & historical corridors"), isOn: $store.showCorridors)
                Toggle(store.text("历史事件", "Historical events"), isOn: $store.showEvents)
                Toggle(store.text("前期疆域残影", "Previous boundary outlines"), isOn: $store.showGhost)
            }
            Section(store.text("自然与现代参考", "Landscape & modern reference")) {
                Toggle(store.text("地形阴影", "Terrain relief"), isOn: $store.showTerrain)
                Toggle(store.text("山川水系", "Rivers, lakes & mountains"), isOn: $store.showWater)
                Toggle(store.text("现代省界", "Modern province boundaries"), isOn:$store.showModern)
                Toggle(store.text("现代省名", "Modern province names"), isOn:$store.showProvinceNames)
                Toggle(store.text("今日参考 · 道路与建筑", "Today · roads & buildings"),isOn:$store.showTodayReference)
                Text(store.text("今日参考需联网，显示现代地物，不代表古代道路。历史遗址首批覆盖唐代长安—洛阳，点位为约略位置。","Today reference requires internet and shows present-day features. The historical site pilot covers Tang Chang’an–Luoyang with approximate locations.")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
            }
            Section(store.text("时间轴", "Timeline")) {
                Toggle(store.text("锁定当前时代", "Stay within this period"), isOn: $store.lockPeriod)
                Picker(store.text("播放速度", "Playback speed"), selection: $store.playbackSpeed) { ForEach([0.25,0.5,1.0,2.0,4.0], id: \.self) { Text(String(format: "%g×", $0)).tag($0) } }
                ForEach(store.dynasty?.phases ?? []) { phase in
                    Button { store.setYear(phase.from) } label: { VStack(alignment: .leading, spacing: 5) { Text(store.yearLabel(phase.from)); if !store.english { Text(store.localChinese(phase.overview)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) } } }
                }
            }
            if store.linkYearRange != nil { Section { Button(store.text("解除链接的年份范围","Remove link year range")) { store.linkYearRange=nil } } }
            Section {
                Picker(store.text("语言", "Language"), selection: Binding(get: { store.language }, set: { store.setLanguage($0) })) { Text("简体中文").tag("zh"); Text("繁體中文").tag("zh-tw"); Text("English").tag("en") }
            }
        }.scrollContentBackground(.hidden).navigationTitle(store.text("图层与时间设置", "Layers & timeline"))
    }
}

struct AtlasLegendView: View {
    let store: AtlasStore
    var body: some View {
        List {
            if store.showHistoricalDetail {
                Section(store.text("历史遗址","Historical sites")) {
                    ForEach(["palace","gate","temple"],id:\.self) { kind in
                        HStack { Circle().fill(Color(atlasHex:kind == "palace" ? "#b5452f" : kind == "gate" ? "#36637a" : "#9c6317")).frame(width:10,height:10);Text(store.text(kind == "palace" ? "宫苑" : kind == "gate" ? "城门" : "寺院与石窟",kind == "palace" ? "Palaces" : kind == "gate" ? "Gates" : "Temples & grottoes")) }
                    }
                    Text(store.text("放大查看；名称与可见年代依据史料。点位表示遗址约略位置。","Zoom in to view. Names and visibility follow historical records; markers locate sites approximately.")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                }
            }
            Section(store.text("当前疆域 · 轻点聚焦", "Current polities · tap to focus")) {
                Button(store.text("显示全部政权", "Show all polities")) { store.focusedPolity = "" }
                ForEach(store.mapPolities.filter { $0.role != "neighbor" }) { polity in
                    HStack {
                        Button { store.selectTerritory(polity.title) } label: {
                            HStack { Circle().fill(Color(atlasHex: polity.tint)).frame(width: 12, height: 12); Text(store.text(polity.title, polity.titleEn)); Spacer(); if store.focusedPolity == polity.title { Image(systemName: "checkmark") } }
                        }
                        Button { store.selectTerritory(polity.title);store.fitPolity(polity.title); store.selection = .territory(id: polity.id, title: polity.title, subtitle: polity.titleEn) } label: { Image(systemName: "info.circle") }
                    }
                }
            }
            if store.dynasty?.id == "prc" { Section(store.text("现代省级行政区","Modern provincial reference")) { Text(store.text("省界与省名可分别开关。","Province boundaries and names have separate controls.")).font(AtlasFonts.ui(12)) } }
            if store.mapPolities.contains(where:{ $0.role == "neighbor" }) {
                Section(store.text("周边政权","Neighboring polities")) { ForEach(store.mapPolities.filter { $0.role == "neighbor" }) { polity in
                    Button(store.text(polity.title,polity.titleEn)) { store.focusedPolity=polity.title;store.fitPolity(polity.title) }
                } }
            }
            Section(store.text("关河丝路", "Historical corridors")) {
                ForEach((store.catalog?.corridors ?? []).filter { store.year >= $0.span[0] && store.year <= $0.span[1] }) { corridor in
                    DisclosureGroup(store.text(corridor.title, corridor.titleEn)) {
                        Text(store.text(corridor.summary, corridor.summaryEn)).font(AtlasFonts.ui(15)).lineSpacing(5)
                        Text(store.yearLabel(corridor.span[0]) + " — " + store.yearLabel(corridor.span[1])).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
                        Button(store.text("在地图上查看", "Show on map")) { store.fly(corridor.labelAt, zoom: 4.5) }
                    }
                }
            }
            Section(store.text("地图符号", "Map symbols")) {
                Label(store.text("都城", "Capital"), systemImage: "circle.inset.filled").foregroundStyle(AtlasTheme.vermilion)
                Label(store.text("城邑与州郡治所", "Cities & administrative seats"), systemImage: "smallcircle.filled.circle")
                Label(store.text("关隘与古道", "Passes & historical roads"), systemImage: "mountain.2")
                Label(store.text("历史事件", "Historical event"), systemImage: "flag")
                Text(store.text("长按任意地点查看沿革。缩放地图可显示更细的州郡边界与城邑。", "Touch and hold any location for its history. Zoom in for finer administrative boundaries and settlements.")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
            }
        }.scrollContentBackground(.hidden).navigationTitle(store.text("政权图例", "Polity legend"))
    }
}

struct AtlasMusicView: View {
    let store: AtlasStore
    var body: some View {
        @Bindable var music = store.music
        List {
            Section {
                Button(music.playing ? store.text("暂停", "Pause") : store.text("播放古琴", "Play guqin"), systemImage: music.playing ? "pause.fill" : "play.fill") { music.toggle(store.catalog?.music ?? []) }
                Slider(value: $music.volume, in: 0...1) { Text(store.text("音量", "Volume")) }
                if let error = music.error { Text(error).font(AtlasFonts.ui(12)).foregroundStyle(.red) }
            }
            Section(store.text("曲目", "Tracks")) {
                ForEach(Array((store.catalog?.music ?? []).enumerated()), id: \.element.id) { index, track in
                    Button { music.play(index, store.catalog?.music ?? []) } label: { HStack { Text(store.text(track.zh, track.en)); Spacer(); if music.index == index && music.playing { Image(systemName: "speaker.wave.2") } } }
                }
            }
            Text(store.text("音乐来自 Wikimedia Commons，播放需要联网。", "Music streams from Wikimedia Commons and requires internet access.")).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary)
        }.scrollContentBackground(.hidden).navigationTitle(store.text("古琴音乐", "Guqin music"))
    }
}

struct AtlasQuizPanel: View {
    let store: AtlasStore
    @State private var expandedClue = false
    var body: some View {
        if let quiz = store.quiz {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label(store.text("寻址挑战", "Place challenge") + " · \(min(quiz.index+1, quiz.questions.count))/\(quiz.questions.count)", systemImage: "scope").font(AtlasFonts.ui(12, weight: .semibold))
                    Spacer(); Text("\(quiz.score)").font(AtlasFonts.ui(17)).foregroundStyle(AtlasTheme.vermilion)
                    Button { store.closeQuiz() } label: { Image(systemName: "xmark.circle.fill") }.accessibilityLabel(store.text("结束挑战", "Close challenge"))
                }
                if let question = quiz.current {
                    Text(question.title + " · " + question.dynasty).font(AtlasFonts.serif(20))
                    Text(store.yearLabel(question.year)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion)
                    Text(question.clue.isEmpty ? store.text("在地图上找到此地。", "Find this place on the map.") : question.clue).font(AtlasFonts.ui(12)).lineLimit(expandedClue ? nil : 3).foregroundStyle(AtlasTheme.secondary)
                    Button(store.text(expandedClue ? "收起线索" : "展开完整线索",expandedClue ? "Less" : "Read full clue")) { expandedClue.toggle() }.font(AtlasFonts.ui(10))
                    if quiz.answered {
                        Text(store.text("偏差 \(quiz.lastDistance) 公里 · +\(quiz.lastPoints) 分", "Off by \(quiz.lastDistance) km · +\(quiz.lastPoints) points")).font(AtlasFonts.ui(15, weight: .semibold)).foregroundStyle(AtlasTheme.vermilion)
                        Text(store.text("答案：", "Answer: ") + question.modern).font(AtlasFonts.ui(12))
                        Button(quiz.index + 1 < quiz.questions.count ? store.text("下一题", "Next question") : store.text("查看成绩", "See results")) { store.nextQuiz() }.buttonStyle(.borderedProminent)
                    } else {
                        HStack { Text(store.text("轻点地图放置标记", "Tap the map to place your guess")).font(AtlasFonts.ui(12)); Spacer(); Button(store.text("确认", "Confirm")) { store.confirmQuiz() }.buttonStyle(.borderedProminent).disabled(quiz.guess == nil) }
                    }
                } else {
                    Text("\(quiz.score) / \(quiz.questions.count * 100)").font(AtlasFonts.serif(34))
                    Text(rank(quiz.score)).font(AtlasFonts.ui(17))
                    HStack {
                        Button(store.text("再来一局", "Play again")) { Task { await store.startQuiz() } }.buttonStyle(.borderedProminent)
                        ShareLink(item: store.text("江山时序·古地名寻址挑战：", "Jiangshan Atlas place challenge: ") + "\(quiz.score)/1000 · " + rank(quiz.score)) { Label(store.text("分享", "Share"), systemImage: "square.and.arrow.up") }
                    }
                }
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(AtlasTheme.paper).clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24))
        }
    }
    private func rank(_ score: Int) -> String {
        score >= 850 ? store.text("太史令 · 舆图大家", "Grand Historian · Master Cartographer") : score >= 650 ? store.text("职方郎中 · 熟稔疆理", "Geographer · Realm Expert") : score >= 400 ? store.text("州郡从事 · 略通古今", "Provincial Scholar") : store.text("江湖行客 · 不妨多逛逛时间轴", "Wandering Traveler · Keep exploring")
    }
}
