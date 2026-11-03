import SwiftUI

private enum AtlasSheet: String, Identifiable {
    case search, journeys, bookmarks, details, about, route, chronicle, music, options, legend, guide
    var id: String { rawValue }
}

struct ContentView: View {
    @Bindable var store: AtlasStore
    @State private var sheet: AtlasSheet?
    private var playing: Bool { get { store.playing } nonmutating set { store.playing=newValue } }
    @State private var isWide = false
    @State private var enteringYear = false
    @State private var yearInput = ""
    @State private var timelineExpanded=false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var mapFocused: Bool

    var body: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width >= 760
            let panelWidth=min(350,geometry.size.width*0.34)
            ZStack(alignment:.trailing) {
                HStack(spacing:0) {
                    mapScreen.frame(maxWidth:.infinity,maxHeight:.infinity)
                    if wide,store.sidebarVisible,store.inspectorDocked,store.catalog != nil,store.quiz == nil { inspector.frame(width:panelWidth).background(AtlasTheme.paper) }
                }
                if wide,store.sidebarVisible,!store.inspectorDocked,store.catalog != nil,store.quiz == nil {
                    inspector.frame(width:panelWidth)
                        .background(AtlasTheme.paper,in:RoundedRectangle(cornerRadius:22))
                        .overlay { RoundedRectangle(cornerRadius:22).stroke(AtlasTheme.ink.opacity(0.09)) }
                        .shadow(color:AtlasTheme.ink.opacity(0.1),radius:16,y:5)
                        .padding(.top,64).padding(.bottom,max(128,store.mapBottomHeight+16)).padding(.trailing,12)
                        .transition(.move(edge:.trailing).combined(with:.opacity))
                }
            }
            .onChange(of:wide && store.sidebarVisible && !store.inspectorDocked,initial:true) { _,floating in store.mapRightWidth=floating ? panelWidth+24 : 0 }
            .onChange(of:geometry.size.width) { _,_ in store.mapRightWidth=wide && store.sidebarVisible && !store.inspectorDocked ? panelWidth+24 : 0 }

            .onAppear { isWide = wide }
            .onChange(of: wide) { _, value in isWide = value; if value && sheet == .details { sheet = nil } }
        }
        .foregroundStyle(AtlasTheme.ink).background(AtlasTheme.paper)
        .focusable().focused($mapFocused).focusEffectDisabled()
        .onAppear { mapFocused=true }
        .onChange(of:sheet) { _,value in if value == nil { mapFocused=true } else { playing=false } }
        .sheet(item: $sheet) { destination in
            NavigationStack {
                sheetContent(destination).background(AtlasTheme.paper)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button(store.text("完成", "Done")) { sheet = nil } } }
            }
            .presentationDetents(destination == .details ? [.medium, .large] : [.large])
            .presentationDragIndicator(.visible)
            .onGeometryChange(for:Double.self) { Double($0.size.height) } action: { height in store.mapCardHeight=destination == .details ? height : 0 }
            .onDisappear { store.mapCardHeight=0;if destination == .guide { store.dismissOnboarding() } }
        }
        .alert(store.text("历史年份", "Historical year"), isPresented: $enteringYear) {
            TextField(store.text("公元前年份用负数", "Use negative years for BCE"), text: $yearInput).keyboardType(.numbersAndPunctuation)
            Button(store.text("前往", "Go")) { if let year = Int(yearInput) { playing = false; store.setYear(year) } }
            Button(store.text("取消", "Cancel"), role: .cancel) { }
        }
        .alert(store.text("提示", "Atlas"), isPresented: Binding(get: { store.actionError != nil }, set: { if !$0 { store.actionError = nil } })) {
            Button(store.text("好", "OK")) { store.actionError = nil }
        } message: { Text(store.actionError ?? "") }
        .overlay { if store.busy { ProgressView().padding(22).background(AtlasTheme.paper, in: RoundedRectangle(cornerRadius: 16)).shadow(radius: 10) } }
        .task(id: playing) {
            guard playing else { return }
            store.beginPlayback()
            while !Task.isCancelled {
                do { try await Task.sleep(for: .milliseconds(store.playbackInterval)) } catch { return }
                guard playing, !Task.isCancelled else { return }
                if !store.advancePlayback() { playing = false; return }
            }
        }
        .onChange(of:playing) { _,active in
            if active { withAnimation(reduceMotion ? nil : .spring(response:0.38,dampingFraction:0.88)) { timelineExpanded=false };store.sidebarVisible=false }
        }
        .onChange(of:store.catalog?.version) { _,version in if version != nil && store.onboarding { sheet = .guide } }
        .onKeyPress { press in
            guard sheet == nil,!enteringYear else { return .ignored }
            switch press.key {
            case .space: if store.quiz != nil { if store.quiz?.answered == true { store.nextQuiz() } else { store.confirmQuiz() } } else { playing.toggle() };return .handled
            case .leftArrow: playing=false;if press.modifiers.contains(.shift) { store.setYear(store.year-10) } else { store.step(-1) };return .handled
            case .rightArrow: playing=false;if press.modifiers.contains(.shift) { store.setYear(store.year+10) } else { store.step(1) };return .handled
            case .home: playing=false;store.setYear(store.minYear);return .handled
            case .end: playing=false;store.setYear(store.maxYear);return .handled
            case .escape: store.selection=nil;store.experience=nil;store.closeQuiz();return .handled
            default:return .ignored
            }
        }
        .onChange(of: store.selection?.id) { _, id in if id != nil { store.playing=false;if isWide { store.sidebarVisible=true } else { sheet = .details } } }
        .onChange(of:store.experience?.id) { _,id in if id != nil && sheet == .details { sheet=nil } }
        .onChange(of: store.quiz != nil) { _, active in if active { playing = false; sheet = nil } }
    }

    private var mapScreen: some View {
        ZStack {
            if store.catalog != nil {
                AtlasMapView(store: store, revision: store.mapRevision, onSelect: select).ignoresSafeArea()
            } else if let error = store.error {
                ContentUnavailableView(store.text("地图未能载入", "Couldn’t open the atlas"), systemImage: "map", description: Text(error))
            } else {
                VStack(spacing: 16) { Text("江山时序").font(AtlasFonts.serif(34, weight: .medium)); ProgressView() }
            }
            if let error = store.mapError { VStack { Spacer(); Text(error).font(AtlasFonts.ui(12)).padding().background(AtlasTheme.paper).padding() } }
        }
        .safeAreaInset(edge: .top, spacing: 0) { header.onGeometryChange(for:Double.self) { Double($0.size.height) } action: { store.mapTopHeight=$0 } }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if store.catalog != nil {
                VStack(spacing: 10) {
                    if store.showTodayReference {
                        VStack(spacing:3) {
                            Button { store.showTodayReference=false } label:{Label(store.text("今日参考 · 非历史道路","Today reference · modern features"),systemImage:"xmark.circle.fill")}
                            HStack(spacing:3) {
                                Link("OpenFreeMap",destination:URL(string:"https://openfreemap.org")!)
                                Link("© OpenMapTiles",destination:URL(string:"https://openmaptiles.org")!)
                                Link("Data from OpenStreetMap",destination:URL(string:"https://www.openstreetmap.org/copyright")!)
                            }.font(AtlasFonts.ui(9))
                        }.font(AtlasFonts.ui(11)).padding(7).background(AtlasTheme.paper.opacity(0.94),in:RoundedRectangle(cornerRadius:12))
                    }
                    // Keep the same space when an event changes or is dismissed, so
                    // the map's logical viewport never shifts during a scrub.
                    if store.selection == nil,store.experience == nil,store.quiz == nil,let event=store.autoEvent ?? store.catalog?.events.first {
                        let visible=store.autoEvent != nil && !store.autoEventDismissed
                        AtlasEventPeek(store:store,event:event) { select(.event(event)) }
                            .opacity(visible ? 1 : 0).allowsHitTesting(visible).accessibilityHidden(!visible)
                            .transaction { $0.animation=nil }
                    }
                    if store.quiz != nil { AtlasQuizPanel(store: store) }
                    else { timeline }
                }
                .onGeometryChange(for:Double.self) { Double($0.size.height) } action: { store.mapBottomHeight=$0 }
            }
        }
    }

    private var header: some View {
        GlassEffectContainer(spacing:12) { HStack(spacing: 10) {
            Button { playing=false;sheet = .search } label:{ Image(systemName:"magnifyingglass").frame(width:44,height:44) }
                .accessibilityLabel(store.text("搜索地点与人物","Search places and people")).disabled(store.quiz != nil)
            Spacer()
            if isWide { Button { if !store.sidebarVisible { store.playing=false };withAnimation(reduceMotion ? nil : .easeInOut(duration:0.25)) { store.sidebarVisible.toggle() } } label:{Image(systemName:"sidebar.right").frame(width:44,height:44)}.accessibilityLabel(store.text("收起或展开编年侧栏","Toggle chronicle sidebar")) }
            Button { playing=false;sheet = .options } label:{Image(systemName:"square.3.layers.3d").frame(width:44,height:44)}.accessibilityLabel(store.text("图层与时间设置","Layers and timeline")).disabled(store.quiz != nil)
            Menu {
                Section(store.localChinese("江山时序")) {
                    Button(store.text("人物与同行", "People & encounters"), systemImage: "person.2") { playing = false; sheet = .journeys }
                    Button(store.text("自定义路线", "Custom routes"), systemImage: "point.topleft.down.to.point.bottomright.curvepath") { playing = false; sheet = .route }
                    Button(store.text("编年纪事", "Chronicle"), systemImage: "text.book.closed") { sheet = .chronicle }
                    Button(store.text("古地名寻址挑战", "Ancient place challenge"), systemImage: "scope") { playing = false; Task { await store.startQuiz() } }
                    Button(store.text("使用指南","Getting started"),systemImage:"sparkles") { sheet = .guide }
                    Button(store.text("古琴音乐", "Guqin music"), systemImage: "music.note") { sheet = .music }
                }.disabled(store.quiz != nil)
                Section(store.text("地图","Map")) {
                    Button(store.text("细看唐代长安","Explore Tang Chang’an"),systemImage:"building.columns") { store.exploreFocusCity("changan") }
                    Button(store.text("细看唐代洛阳","Explore Tang Luoyang"),systemImage:"building.columns") { store.exploreFocusCity("luoyang") }
                    Button(store.text("查看地图中心沿革","Inspect map center"),systemImage:"mappin.and.ellipse") { store.inspect([store.cameraLongitude,store.cameraLatitude]) }
                    Button(store.text("复位地图","Reset map"),systemImage:"arrow.up.left.and.arrow.down.right") { store.resetCamera() }
                    Button(store.text("放大","Zoom in"),systemImage:"plus") { store.fly([store.cameraLongitude,store.cameraLatitude],zoom:store.cameraZoom+1,waitsForLayout:false) }
                    Button(store.text("缩小","Zoom out"),systemImage:"minus") { store.fly([store.cameraLongitude,store.cameraLatitude],zoom:store.cameraZoom-1,waitsForLayout:false) }
                    if isWide { Toggle(store.text("停靠侧栏","Dock inspector"),isOn:$store.inspectorDocked) }
                    Button(store.text("图层与时间设置", "Layers & timeline"), systemImage: "slider.horizontal.3") { sheet = .options }
                    Button(store.text("政权图例", "Polity legend"), systemImage: "list.bullet.rectangle") { sheet = .legend }
                    Button(store.text("收藏", "Bookmarks"), systemImage: "bookmark") { sheet = .bookmarks }
                    Button(store.text("收藏此刻", "Bookmark this view"), systemImage: "bookmark.fill") { store.saveBookmark() }
                    ShareLink(item:store.shareURL) { Label(store.text("分享网页链接","Share web link"),systemImage:"square.and.arrow.up") }
                    ShareLink(item:store.nativeShareURL) { Label(store.text("分享应用链接","Share app link"),systemImage:"app.badge") }
                }.disabled(store.quiz != nil)
                Picker(store.text("语言", "Language"), selection: Binding(get: { store.language }, set: { store.setLanguage($0) })) {
                    Text("简体中文").tag("zh"); Text("繁體中文").tag("zh-tw"); Text("English").tag("en")
                }
                Button(store.text("关于江山时序", "About the atlas"), systemImage: "info.circle") { sheet = .about }
            } label: { Image(systemName: "ellipsis").frame(width:44,height:44) }
            .accessibilityLabel(store.text("探索菜单", "Explore menu"))
            .accessibilityIdentifier("atlas.explore.menu")
            .buttonStyle(AtlasPausingMenuStyle(store:store))
        }.buttonStyle(.glass).buttonBorderShape(.circle).tint(AtlasTheme.ink) }
        .padding(.horizontal,16).padding(.top,8).padding(.bottom,4)
    }

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 10) {
            if store.experience != nil {
                if timelineExpanded { AtlasExperiencePanel(store:store) { sheet = .chronicle } }
                else { AtlasJourneyPeek(store:store) { sheet = .chronicle } }
                Divider()
            } else if store.selection != nil,!isWide {
                Button { sheet = .details } label:{ HStack { Image(systemName:"mappin.and.ellipse");Text(store.selectionTitle).lineLimit(1);Spacer();Image(systemName:"chevron.up") }.font(AtlasFonts.ui(12)) }
            }
            HStack {
                Button { yearInput = String(store.year); enteringYear = true } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.yearLabel()).font(AtlasFonts.serif(timelineExpanded ? 25 : 20, weight: .regular)).monospacedDigit().lineLimit(1,reservesSpace:true).minimumScaleFactor(0.75).accessibilityIdentifier("atlas.timeline.year")
                        Text(store.eraLabel.isEmpty ? store.dynasty.map { store.text($0.title, $0.titleEn) } ?? "" : store.eraLabel).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.vermilion).lineLimit(1,reservesSpace:true)
                    }.multilineTextAlignment(.leading)
                }.buttonStyle(.plain)
                Spacer(minLength: 4)
                if timelineExpanded { Button { playing = false; store.step(-1) } label: { Image(systemName: "backward.end").frame(width: 32, height: 40) }.accessibilityLabel(store.text("上一阶段", "Previous stage")) }
                Button { playing.toggle() } label: { Image(systemName: playing ? "pause.fill" : "play.fill").frame(width: 40, height: 40) }
                    .foregroundStyle(AtlasTheme.paper).background(AtlasTheme.vermilion, in: Circle()).accessibilityLabel(playing ? store.text("暂停", "Pause") : store.text("播放", "Play"))
                    .accessibilityIdentifier("atlas.playback.toggle")
                if timelineExpanded { Button { playing = false; store.step(1) } label: { Image(systemName: "forward.end").frame(width: 32, height: 40) }.accessibilityLabel(store.text("下一阶段", "Next stage")) }
                Button { withAnimation(reduceMotion ? nil : .spring(response:0.38,dampingFraction:0.88)) { timelineExpanded.toggle() } } label:{Image(systemName:"chevron.up").rotationEffect(.degrees(timelineExpanded ? 180 : 0)).frame(width:36,height:40)}.accessibilityLabel(store.text(timelineExpanded ? "收起时间轴" : "展开时间轴",timelineExpanded ? "Collapse timeline" : "Expand timeline"))
            }
            if let range=store.linkYearRange { HStack { Text(store.yearLabel(range.lowerBound) + " — " + store.yearLabel(range.upperBound));Spacer();Button(store.text("完整时间轴","Full timeline")) { store.linkYearRange=nil } }.font(AtlasFonts.ui(10)) }
            Slider(value: Binding(get: { store.timelineProgress(store.year) }, set: { store.setYear(store.year(atProgress:$0)) }), in: 0...1, onEditingChanged: { moving in store.isScrubbing=moving;if moving { playing = false; store.journey = nil; store.experience = nil } })
                .accessibilityLabel(store.text("历史年份", "Historical year")).accessibilityValue(store.yearLabel())
                .accessibilityIdentifier("atlas.timeline.slider")
            if timelineExpanded {
            AtlasTimelineBands(store:store) { dynasty in playing=false;store.lockPeriod=false;store.choose(dynasty) }
            ScrollViewReader { proxy in
                ScrollView(.horizontal) {
                    HStack(spacing: 6) {
                        ForEach(store.catalog?.dynasties ?? []) { dynasty in
                            Button { playing = false; store.lockPeriod = false; store.choose(dynasty) } label: {
                                Text(store.text(dynasty.title, dynasty.titleEn)).font(AtlasFonts.ui(12, weight: store.dynasty?.id == dynasty.id ? .semibold : .regular))
                                    .padding(.horizontal, 12).padding(.vertical, 8)
                                    .foregroundStyle(store.dynasty?.id == dynasty.id ? AtlasTheme.paper : AtlasTheme.ink)
                                    .background(store.dynasty?.id == dynasty.id ? AtlasTheme.vermilion : AtlasTheme.ink.opacity(0.045), in: Capsule())
                            }.id(dynasty.id)
                        }
                    }
                }.scrollIndicators(.hidden)
                    .onAppear { if let id = store.dynasty?.id { proxy.scrollTo(id, anchor: .center) } }
                    .onChange(of: store.dynasty?.id) { _, id in if let id { withAnimation(.easeInOut(duration: 0.2)) { proxy.scrollTo(id, anchor: .center) } } }
            }
            }
        }
        .padding(.horizontal,18).padding(.top,12).padding(.bottom,8)
        .background(AtlasTheme.paper,in:RoundedRectangle(cornerRadius:24))
        .overlay { RoundedRectangle(cornerRadius:24).stroke(AtlasTheme.ink.opacity(0.08)) }
        .shadow(color:AtlasTheme.ink.opacity(0.1),radius:12,y:3)
        .padding(.horizontal,12).padding(.bottom,8)
    }

    private var inspector: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment:.leading,spacing:22) {
                    HStack { Text(store.text("史志","CHRONICLE")).font(AtlasFonts.ui(10,weight:.medium)).foregroundStyle(AtlasTheme.secondary);Spacer();Button { store.sidebarVisible=false } label:{Image(systemName:"xmark").frame(width:28,height:28)}.accessibilityLabel(store.text("关闭侧栏","Close inspector")) }.id("inspector-top")
                    AtlasInspector(store:store,onSelect:select)
                    if store.selection == nil { Divider();AtlasChronicleRows(store:store) }
                }.padding(22)
            }
            .onChange(of:store.selection?.id) { _,id in proxy.scrollTo(id == nil ? store.currentMilestone?.id ?? "inspector-top" : "inspector-top",anchor:id == nil ? .center : .top) }
            .onChange(of:store.currentMilestone?.id) { _,id in if store.selection == nil,let id { withAnimation { proxy.scrollTo(id,anchor:.center) } } }
        }
    }

    private func select(_ selection: AtlasSelection) {
        playing = false
        switch selection {
        case .place(let place): store.select(place)
        case .event(let event): store.select(event)
        case .coordinate(_, let title, let coord): store.inspect(coord, title: title)
        case .territory: store.selection = selection
        }
        if !isWide { sheet = .details }
    }
    @ViewBuilder private func sheetContent(_ destination: AtlasSheet) -> some View {
        switch destination {
        case .search: AtlasSearchView(store: store) { sheet = nil }
        case .journeys: AtlasPeopleView(store: store) { sheet = nil }
        case .route: AtlasRouteView(store: store) { sheet = nil }
        case .chronicle: AtlasChronicleView(store: store)
        case .music: AtlasMusicView(store: store)
        case .options: AtlasOptionsView(store: store)
        case .legend: AtlasLegendView(store: store)
        case .bookmarks:
            List {
                Button(store.text("收藏当前画面", "Bookmark current view"), systemImage: "bookmark.badge.plus") { store.saveBookmark() }
                ForEach(store.bookmarks) { bookmark in
                    Button { store.restore(bookmark); sheet = nil } label: { VStack(alignment: .leading, spacing: 5) { Text(bookmark.title); Text(store.yearLabel(bookmark.year)).font(AtlasFonts.ui(12)).foregroundStyle(AtlasTheme.secondary) } }
                }.onDelete(perform: store.deleteBookmarks)
            }.scrollContentBackground(.hidden).navigationTitle(store.text("收藏", "Bookmarks"))
        case .details: ScrollViewReader { proxy in ScrollView { AtlasInspector(store: store, onSelect: select).padding(24) }.onChange(of:store.dynasty?.id) { _,id in if let id { withAnimation { proxy.scrollTo(id,anchor:.top) } } } }.navigationTitle(store.text("点地溯源", "Place & history")).navigationBarTitleDisplayMode(.inline)
        case .guide: AtlasWelcomeView(store:store) { sheet=nil }
        case .about: AtlasAboutView(store: store)
        }
    }
}

private struct AtlasPausingMenuStyle: ButtonStyle {
    let store:AtlasStore
    func makeBody(configuration:Configuration)->some View {
        configuration.label.padding(6)
            .glassEffect(.regular.interactive(),in:.circle)
            .onChange(of:configuration.isPressed) { _,pressed in if pressed { store.playing=false } }
    }
}
