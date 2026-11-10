# Chronicles of the Realm · 江山时序

<p align="left">
  <a href="README.md">English</a> · <a href="README_ZH.md">简体中文 (Chinese)</a> · <a href="README_ZH_HANT.md">繁體中文</a> · <strong>日本語</strong>
</p>

**戦国時代（紀元前 403 年）から現在までの、中国のインタラクティブな歴史地図 — 時間をスクロールし、古都の歴史をたどり、歴史上の人物の足跡を追いかけられます**

[**ライブデモを試す（英語 UI）→ https://deanchen.me/jiangshan-map/?lang=en**](https://deanchen.me/jiangshan-map/?lang=en)

*誕生の経緯（中国語）：[教科書の地図から GitHub の 1k スターまで](https://deanchen.me/history/atlas/2026/10/25/jiangshan-map-story.html)*

<p align="center">
  <a href="https://www.star-history.com/deanchensj/jiangshan-map">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=deanchensj/jiangshan-map&type=trending&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=deanchensj/jiangshan-map&type=trending" />
      <img alt="GitHub Trending · Repository of the Day #2" src="https://api.star-history.com/badge?repo=deanchensj/jiangshan-map&type=trending" height="56" />
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://deanchen.me/jiangshan-map/?lang=en">
    <img src="assets/hero_demo_en.webp" alt="Chronicles of the Realm — 15 秒のインタラクティブな概要（戦国の統一、2,400 年にわたる王朝のスクロール、長安の地名の系譜、蘇軾の流謫の道のり）" width="100%" />
  </a>
</p>

---

## 探索が楽しい理由

中国の歴史や古典の詩を読みながら、こんなことを考えたことはありませんか。
- *「建康（六朝の都）、黄州（蘇東坡が流謫の地で『赤壁賦』を詠んだ場所）、秦嶺山脈の藍関（韓愈が雪の中で馬を止めた場所）、朱仙鎮（岳飛の北伐の最前線）は、今の地図ではいったいどこにあるのだろう？」*
- *「長安は 2,000 年の間にいくつの名前を持ち、その地ではどんな重要な出来事が起きたのだろう？」*
- *「司馬光の『資治通鑑』の冒頭にある三家分晋と戦国七雄（紀元前 403 年）から、秦の統一戦争、漢の武帝による河西回廊の開拓、盛唐の安西四鎮、元の宣政院によるチベットの管轄、曽紀沢によるイリの回復（1881 年）、そして 20 世紀の『秋海棠』（秋海棠）の地図から『雄鶏』（雄鸡）の地図への移り変わりまで、天下はどのように一歩ずつ変わってきたのだろう？」*

**Chronicles of the Realm（`jiangshan-map`）** は、**18 の歴史的な時代**にわたる **2,400 年以上**の中国の歴史を、1 枚のインタラクティブな羊皮紙風の地図にまとめています。**多段階の領土と行政区画のスナップショット**、**古都**、**戦略上の峠**、**詩と戦場の名所**、**年代順の出来事**、**在位中の君主と元号**を収めています。重い印刷の地図帳は必要ありません。タイムラインをドラッグし、どの都市でもクリックすれば、時空を旅できます。

---

### 機能 1：タイムラインをスクロールして、国々の興亡を眺め、君主を追い、古今の国境を比べる

- **1 枚のキャンバスで複数の勢力が対峙**：戦国七雄（秦、楚、斉、燕、趙、魏、韓）と周、越、巴蜀、中山、義渠から、三国時代の群雄（袁紹、曹操、劉備、孫権、遼東の公孫氏）、南北朝、五代十国、そして宋、遼、西夏、大理、金、モンゴルまで、すべてが伝統的な羊皮紙のコントラストの強い色合いで並べて描かれます。左下の凡例でどれかの勢力にカーソルを合わせるとその領土が強調され、クリックするとそこへまっすぐズームします。
- **多段階の領土の変遷と、破線の「Ghost Boundary Diff」**：秦の巴蜀の征服（紀元前 316 年）、燕の将軍・秦開による遼東への拡大（紀元前 300 年）、交趾に立てた馬援の銅柱（43 年）、司馬懿の遼東遠征（238 年）、李靖による吐谷渾の征服（635 年）、安西四鎮と王玄策の中天竺への遠征（648 年）、元の宣政院によるチベットの統治（1288 年）、明の哈密と嘉峪関以西の七衛（1404 年）、イリを回復した 1881 年のサンクトペテルブルク条約、1898 年の外国の租借地、1945 年の台湾の返還、そして 1946 年の **「秋海棠」（秋海棠）** の地図から **「雄鶏」（雄鸡）** の地図への移行など、領土の大きな節目ごとに、出来事や時期の点をクリックすると地図が切り替わり、前の時期の朱色の破線の **Ghost Boundary Diff** が表示されるので、領土の増減がひと目でわかります。
- **在位中の君主と元号のインライン表示**：タイムラインには、在位中の君主（廟号・諡号 + 名 + 在位期間。例：`Emperor Wu of Han · Liu Che`、`Emperor Taizong of Tang · Li Shimin`、`Emperor Shengzu of Qing · Xuanye`）と、その正確な元号の年が動的に表示されます。
- **古代の行政区画のホバーでの確認と、現代の X-Ray Lens**：第一級の行政区画（郡、道、路、省）は、重複を除いた **Parchment Casing** の境界線で描かれます。ズームしてどの行政区画（例：明の `Yingtian Prefecture` や三国時代の `Jingzhou`）にカーソルを合わせても、その管轄と対応する現代の省を確認できます。**X-Ray Lens** を切り替えると、現代の省の境界線を歴史地図の上に直接重ねられます。
- **動く河道、古代の湖、大規模な土木事業**：時間をスクロールすると、黄河の流路の歴史的な変化、広がったり縮んだりする古代の湖（*雲夢沢*、*ロプノール / 蒲昌海*）、戦国・秦・漢・明の長城、隋唐の運河と大運河、シルクロード、鄭和の航路が、それぞれの時代に合わせて変わっていきます。渤海湾、江蘇北部、長江河口、珠江デルタの古代の海岸線も、時代とともに前進・後退します。
- **ズームできるタイムライン**：タイムライン両端のハンドルを内側へドラッグすると、その期間だけを拡大できます（秦、三国、五代のような短い時代に便利です）。タイムラインをダブルクリックすると全体表示に戻ります。

> [ライブで試す：明の永楽 13 年（1415 年）· 両京十三布政使司と「Yingtian Prefecture」の確認 →](https://deanchen.me/jiangshan-map/?year=1415&zoom=1.75&center=115.8,33.2&hover=Yingtian%20Prefecture&lang=en)

![明 1415 年 · Yingtian Prefecture のホバーのプレビュー](assets/preview_1415_ming_yingtian_en.webp)

---

### 機能 2：古都や戦略上の峠をクリックして、2,400 年の歴史をひもとく（`Trace Place`）

地図上の **古都や峠をクリック** する（またはキャンバスのどこかをダブルクリックする）と、その **Trace Place** の系譜カードが開きます。
- **2 か国語の都市の伝承バナーと、2,400 年にわたる行政の系譜**：カードの上部では、その都市について厳選した **詩の題辞と歴史の紹介** を読めます。その下では、戦国と秦の郡、漢の州刺史部、唐の道、宋の路から、元・明・清の省、現代の市まで、18 のすべての時代を通じて、その名前と行政上の管轄がどう変わったかをたどれます。`Imperial Capital` のバッジと、王朝の治所についての注記も付いています。
- **その地で起きた出来事**：それぞれの王朝の行の下で、まさにその場所で起きた大きな歴史上の出来事を確認できます（例：咸陽での *商鞅の変法* と *秦の統一*、樊城での *関羽の水攻め（七軍を水没させる）*、長安での *玄武門の変*、臨安での *岳飛の死*）。カードの右上にある **`Key Events`** のピルをクリックすると大きな出来事のある王朝だけに絞り込め、どの出来事をクリックしてもその年へタイムトラベルできます！
- **戦略上の峠と、詩・戦場の名所**：*函谷関*、*潼関*、*剣門関*、*雁門関*、*玉門関*、*陽関*、*山海関* などの有名な峠を探索できます。これらは伝統的な *漢闕* の門楼のアイコンと、戦略上の地形のメモとともに描かれます。あわせて、*赤壁*、*垓下*、*五丈原*、*蘭亭*、*岳陽楼*、*滕王閣*、*藍関*、*楼蘭*、*ロプノール*、*イシク・クル* などの有名な戦場と文学の名所もあります。

> [ライブで試す：盛唐の開元 29 年（741 年）· 長安の 2,400 年の系譜カードを開く →](https://deanchen.me/jiangshan-map/?year=741&place=Chang'an&lang=en)

![盛唐 741 年 · 長安の Trace Place と Key Events](assets/preview_741_tang_trace_en.webp)

---

### 機能 3：Person Chronicles — 歴史上の人物を時空を超えてたどる

左上の **Universal Search Box** をクリックする（`e.g.` の人物のプレビューが切り替わり、クイック検索のチップもあります。または `Cao Cao`、`Huo Qubing`、`Sima Qian`、`Yue Fei`、`Zheng He` など、君主、武将、政治家、僧、詩人を入力します）と、**Person Chronicle（`点人溯事`）** が開き、変わっていく王朝の国境の上に、その人物の生涯のすべての節目を、繊細な地図の細い弧と方向の目盛りで描きます。
- **始皇帝の統一戦争（紀元前 238～221 年）**：咸陽での反乱の鎮圧と王翦による鄴の攻撃から、韓、趙、燕、魏、楚、代の滅亡を経て、臨淄での斉の降伏まで。1 か所ずつ進むごとに、6 つの敵国が地図の上で秦の帝国に吸収されていく様子が見られます！
- **張騫の西域への使節（紀元前 138～126 年）**：長安を出発し、10 年以上にわたる匈奴での捕囚にも漢の節を手放さずに耐え、大宛（フェルガナ）、康居、大月氏への道を切り開きます。
- **諸葛亮の登場と北伐（207～234 年）**：隆中での三顧の礼と、赤壁の前の柴桑での同盟から、蜀への入国、白帝城での託孤、瀘水を渡った南征、漢中での『出師表』、祁山、そして五丈原の秋風まで。
- **玄奘のインドへの巡礼（627～645 年）**：ひとりで玉門関をすり抜けて莫賀延磧を渡り、凍てつくベデル峠を越え、インダス川を渡り、ナーランダー僧院で学び、曲女城（カナウジ）で論争してから長安に戻ります。
- **李白の唐全土への大旅行（701～762 年）**：砕葉と蜀での少年時代から、24 歳で三峡を下って船出し、揚州で金を散じ、長安の翰林院に仕え、洛陽で杜甫に出会い、白帝城で恩赦を受け、晩年の当塗まで。
- **蘇軾の宋全土にわたる文学と流謫（1056～1101 年）**：眉山を出て都の開封に向かい、密州で月を眺め、黄州での流謫中に『赤壁賦』を詠み、恵州を経て、海を渡って海南島の儋州へ至るまで。
- **王陽明の知行合一（1472～1529 年）**：余姚での誕生と北京での投獄から、貴州の龍場での悟り、南贛での賊の平定、35 日で寧王の反乱を捕らえたこと、紹興の天泉橋での講学、そして南安での最期の言葉 *「此の心光明なり、亦た復た何をか言わん」* まで。
- **複数人物の同時表示**：検索ボックスに 2〜3 人の名前を入力すると（例：`李白 杜甫 高適`、`曹操 劉備 孫権`）、それぞれの足跡が 1 本のタイムラインにまとめられます。同じ年に同じ場所で出会った地点は「同途」として示され、`同途 N` のピルでその地点だけに絞り込めます。
- **歴史的事件のストーリーライン**：大きな事件も、人物の生涯と同じように地点ごとにたどれます。安史の乱（755〜763 年）は 3 幕・10 地点で展開し、唐の討伐軍と反乱軍を 2 色で塗り分けるので、両陣営の動きがひと目でわかります。

次の出来事に進むたびに（`‹ / ›`、`← / →`、または `Space` で自動再生）、**タイムラインの年、在位中の君主、元号、王朝の領土が、その人物の足取りに合わせて変わります**。現在の移動の弧が強調され、まさにその場所で書かれた 2 か国語の一次史料の抜粋や詩も表示されます。

> [ライブで試す：蘇東坡の密州と黄州への流謫をたどる（1075～1082 年）→](https://deanchen.me/jiangshan-map/?person=sushi&lang=en)

![Person Chronicle · 蘇軾の生涯と流謫の道のり](assets/preview_journey_sushi_en.webp)

---

### 機能 4：イースターエッグ · Map Pinpoint Challenge — あなたは朝廷でどの位を得られるか？

中国の歴史地理に詳しいつもりですか？ **Universal Search Box** のガイドバーの隅にある **`Quiz ›`** をクリックしてください（または `quiz` と入力すると **`Map Pinpoint · Ancient Place Quiz`** が開きます）。
- **王朝の歴史の手がかり + 白地図でのピン留め**：都市のラベルが隠され、難易度が段階的に上がる 10 ラウンドの出題で、古都の場所を当てるよう求められます。**王朝の歴史の手がかり** が添えられます（現代の都市名はネタバレしません）。ピンを置いてプレビューと調整をし、ピンの上の **`✓ Confirm`** ボタンをクリックすると答えが確定し、同心円の距離のスコアの輪が表示されます。本当の座標までの大圏距離にもとづいて得点できます！
- 10 ラウンドを終えると、**太史令 · 舆图大家（Grand Historian & Master Cartographer）**、**职方郎中（Director of the Bureau of Operations）**、**州郡从事（Prefectural Retainer）** のような、伝統的な朝廷の地図に関する称号が授けられます。

> [ライブで試す：前漢の武帝、元狩 2 年（紀元前 121 年）· Map Pinpoint Challenge を始める →](https://deanchen.me/jiangshan-map/?year=-121&quiz=locate&lang=en)

![前漢 紀元前 121 年 · Map Pinpoint Challenge のプレビュー](assets/preview_quiz_challenge_en.webp)

---

## キーボードショートカットと共有できるディープリンク

### キーボードショートカット

| キー / 操作 | 効果 |
| :--- | :--- |
| **`/`** または **`Cmd/Ctrl + K`** | **Universal Search Box** にフォーカスします。**歴史上の人物**（`Qin Shi Huang`/`Zhang Qian`/`Su Shi`）、**古今の都市**（`Xianyang`/`Chang'an`/`Luoyang`/`Kaifeng`）、**在位中の君主**（`Emperor Wu of Han`/`Taizong of Tang`/`Liu Che`/`Li Shimin`）、**元号**（`Zhenguan`/`Yongle`/`Kangxi`）、**詩と戦場の名所**（`Red Cliffs`/`Wuzhang Plains`/`Languan`/`Lanting`）、**峠**（`Hangu Pass`/`Jianmen Pass`/`Yumen Pass`）、**歴史上の出来事**、または **Ancient Place Quiz** を検索できます |
| **`←` / `→`** または下部の **`‹ / ›`** | 前 / 次の歴史的な時期、出来事、人物の出来事の地点へ移動します（`Shift + ← / →` を押したままにすると `10` 年ずつ進みます） |
| **`Space`** | タイムラインの変遷を自動再生 / 一時停止します（Person Chronicle のモードでは地点を自動で進めます） |
| **`Esc`** | 開いているポップアップやカードを閉じる、検索の強調表示を消す、または独自の複数地点のルートを終了します |
| **`Single-click city` / `Double-click map`** | その場所の 18 の時代にわたる **Trace Place & Key Events** の系譜カードを開きます |
| **`Hover / Click legend swatch`** | カーソルを合わせるとその勢力の領土だけを強調し、クリックするとその範囲に自動でズームします |

### 共有できるディープリンク

クエリパラメーターを付けると、どんな歴史の瞬間、戦い、都市の系譜、複数地点のルートでも共有できます。
- **特定の年や領土の変化にジャンプ**：[`?year=-403&lang=en`](https://deanchen.me/jiangshan-map/?year=-403&lang=en)（紀元前 403 年 · 三家分晋）/ [`?year=-121&lang=en`](https://deanchen.me/jiangshan-map/?year=-121&lang=en)（紀元前 121 年 · 霍去病が河西回廊を開く）/ [`?year=648&lang=en`](https://deanchen.me/jiangshan-map/?year=648&lang=en)（648 年 · 安西四鎮とインドの王玄策）/ [`?year=1288&lang=en`](https://deanchen.me/jiangshan-map/?year=1288&lang=en)（1288 年 · 元の宣政院によるチベットの管轄）/ [`?year=1881&lang=en`](https://deanchen.me/jiangshan-map/?year=1881&lang=en)（1881 年 · 曽紀沢がイリを回復）/ [`?year=1945&lang=en`](https://deanchen.me/jiangshan-map/?year=1945&lang=en)（1945 年 · 台湾の返還）
- **有名な戦いの場所を示す**：[`?year=-260&place=长平&lang=en`](https://deanchen.me/jiangshan-map/?year=-260&place=长平&lang=en)（長平の戦い）/ [`?year=208&place=赤壁&lang=en`](https://deanchen.me/jiangshan-map/?year=208&place=赤壁&lang=en)（赤壁の戦い）/ [`?year=383&place=淝水&lang=en`](https://deanchen.me/jiangshan-map/?year=383&place=淝水&lang=en)（淝水の戦い）
- **都市の 2,400 年の系譜を確認**：[`?year=741&place=长安&lang=en`](https://deanchen.me/jiangshan-map/?year=741&place=长安&lang=en)（長安 / 西安）/ [`?year=1415&place=应天府&lang=en`](https://deanchen.me/jiangshan-map/?year=1415&place=应天府&lang=en)（建康 / 応天 / 南京）/ [`?year=819&place=蓝关&lang=en`](https://deanchen.me/jiangshan-map/?year=819&place=蓝关&lang=en)（藍関の韓愈）
- **独自の詩や遠征のルートを描く**：[`?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳&lang=en`](https://deanchen.me/jiangshan-map/?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳&lang=en)（763 年の杜甫の帰郷の道のり）/ [`?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州&lang=en`](https://deanchen.me/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州&lang=en)（湖州、黄州、恵州、儋州にわたる、蘇軾の何年にもわたる流謫の道のり）
- **人物の時空の年代記を開く**：[`?person=qinshihuang&lang=en`](https://deanchen.me/jiangshan-map/?person=qinshihuang&lang=en)（始皇帝）/ [`?person=zhangqian&lang=en`](https://deanchen.me/jiangshan-map/?person=zhangqian&lang=en)（張騫）/ [`?person=zhugeliang&lang=en`](https://deanchen.me/jiangshan-map/?person=zhugeliang&lang=en)（諸葛亮）/ [`?person=xuanzang&lang=en`](https://deanchen.me/jiangshan-map/?person=xuanzang&lang=en)（玄奘）/ [`?person=libai&lang=en`](https://deanchen.me/jiangshan-map/?person=libai&lang=en)（李白）/ [`?person=sushi&lang=en`](https://deanchen.me/jiangshan-map/?person=sushi&lang=en)（蘇軾）/ [`?person=wangyangming&lang=en`](https://deanchen.me/jiangshan-map/?person=wangyangming&lang=en)（王陽明）
- **複数人物の比較や事件をたどる**：[`?person=libai,dufu&lang=en`](https://deanchen.me/jiangshan-map/?person=libai,dufu&lang=en)（李白と杜甫）/ [`?person=caocao,liubei,sunquan&lang=en`](https://deanchen.me/jiangshan-map/?person=caocao,liubei,sunquan&lang=en)（曹操・劉備・孫権）/ [`?event=anshi&lang=en`](https://deanchen.me/jiangshan-map/?event=anshi&lang=en)（安史の乱）
- **クイズを始める**：[`?year=-121&quiz=locate&lang=en`](https://deanchen.me/jiangshan-map/?year=-121&quiz=locate&lang=en)（Map Pinpoint Challenge）
- **UI の言語を切り替える**：[`?lang=en`](https://deanchen.me/jiangshan-map/?lang=en)（英語）/ [`?lang=zh-tw`](https://deanchen.me/jiangshan-map/?lang=zh-tw)（繁体字中国語）/ [`/`](https://deanchen.me/jiangshan-map/)（簡体字中国語）

### 自分のページに埋め込む

地図のどんなビューでも、ブログの記事、Notion のページ、講座のサイトに入れられます。

1. 地図を開き、表示したいビュー（年、政権のプロフィール、場所のカード、人物の足跡）を設定します。アドレスバーには常に、表示している内容が反映されています。
2. URL をコピーし、`&embed=1` を追加します。
3. それを `<iframe>` に貼り付けます。

```html
<iframe
  src="https://deanchen.me/jiangshan-map/?embed=1&year=1104&trace=101.778,36.617&from=1072&to=1126&lang=en"
  width="100%" height="480" loading="lazy" style="border:0"
  title="Chronicles of the Realm · 1104 CE, Northern Song"></iframe>
```

埋め込まれた地図では、サイトの枠が隠され、地図、コンパクトなタイムライン、タイトルのチップ、「Open in Jiangshan Atlas ↗」のリンク、歴史上の国境はおおよそのものだという注記だけが残ります。読者は 1 回クリックしてから地図の移動やズームを始めるので、ページのスクロールが地図に引っかかることはありません。

| パラメーター | 効果 |
|---|---|
| `embed=1` | 埋め込みモードをオンにします（必須） |
| `year`、`polity`、`person`、`stop`、`trace`、`lang` | 上の共有リンクと同じです |
| `from=1072&to=1126` | タイムラインをこの範囲に限定します。タイムラインはこの範囲だけを表示するようにズームします |
| `lock=1` | 地図を `year` で固定し、タイムラインを隠します |
| `autoplay=1` | 人物の足跡を 1 か所ずつ再生する（`person` と組み合わせる）か、タイムラインを再生します |

WeChat の公式アカウント、Zhihu、Xiaohongshu では iframe が使えないので、代わりに通常のリンクを共有してください。

---

## AI エージェント、MCP、LLM との連携

**Chronicles of the Realm** は、そのままで **LLM、MCP クライアント、AI エージェントのための歴史地理の可視化エンジン** として使えます。モデルが **緯度や経度の座標を推測する必要はまったくありません**。詩や歴史の文章から **`year`** と **`place`** という 2 つの意味的なパラメーターを取り出すだけで、地図が古今の地名を自動で解決し、カメラを中央に合わせ、王朝の国境と複数地点の足跡を描いて、**Trace Place** の系譜カードを開きます。

- **機械が読める仕様**：[`llms.txt`](llms.txt)
- **依存のないローカルの MCP サーバー（`stdio`）**：[`scripts/mcp_server.js`](scripts/mcp_server.js) — Claude Desktop、Cursor、Windsurf、Gemini CLI の `mcpServers` に追加します。
  ```json
  {
    "mcpServers": {
      "jiangshan-atlas": {
        "command": "node",
        "args": ["/absolute/path/to/jiangshan-map/scripts/mcp_server.js"]
      }
    }
  }
  ```
  3 つのネイティブの MCP ツールを公開しています（オフラインで `<5ms` の応答、npm の依存なし）。
  - `inspect_place({ year, place, lang? })`：在位中の君主 / 元号、支配していた政権（`polity`）、広域の地域（`dao/lu/province`）、行政区画（`jun/zhou/fu`）、現代の省 / 市、2,400 年の `lore`、共有できるディープリンクの URL を返します。
  - `inspect_person({ person, stop?, lang? })`：歴史上の人物や君主の伝記、王朝をまたいで年代順に位置情報を付けた地点、共有できるディープリンクの URL を返します。
  - `search_atlas({ query, limit?, lang? })`：すべての古都、詩と戦場の名所、峠、歴史上の人物、元号、年代順の出来事を横断して検索します。
- **すぐに使える Agent Skill**：[`skills/jiangshan-atlas/SKILL.md`](skills/jiangshan-atlas/SKILL.md)（依存のない CLI のレンダラー [`skills/jiangshan-atlas/scripts/jiangshan.py`](skills/jiangshan-atlas/scripts/jiangshan.py) を含みます）
  ```bash
  # Install into Claude Code / Gemini / Jetski global skills directory:
  mkdir -p ~/.claude/skills ~/.gemini/config/skills && cp -r skills/jiangshan-atlas ~/.claude/skills/ && cp -r skills/jiangshan-atlas ~/.gemini/config/skills/
  ```

### 1. 座標不要の 2 パラメーターの URL プロトコル（0D の地点 / 1D の同年のルート / 4D の複数年のルート）

| モード | URL の例 | 自動の描画の動作 |
| :--- | :--- | :--- |
| **単一地点（0D）** | [`?year=819&place=蓝关&lang=en`](https://deanchen.me/jiangshan-map/?year=819&place=蓝关&lang=en)<br>*（819 年、藍関での韓愈の流謫の詩）* | 唐の元和 14 年（819 年）にジャンプし、秦嶺山脈の藍関にピンを置いて、その 2,400 年の行政の系譜カードを開きます |
| **同じ年の複数地点のルート（1D）** | [`?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳&lang=en`](https://deanchen.me/jiangshan-map/?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳&lang=en)<br>*（763 年、河南と河北の奪還を詠んだ杜甫の詩）* | 763 年の唐の地図の上に、`1` → `5` の番号付きの朱色の弧を描き、表示範囲を自動で合わせます。どの地点をクリックしても、その系譜を確認できます |
| **複数年の時空のルート（4D）** | [`?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州&lang=en`](https://deanchen.me/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州&lang=en)<br>*（湖州、黄州、恵州、儋州にわたる蘇軾の経歴）* | `year[i]` と `place[i]` を組にし、地点にその歴史上の年のラベルを付けて、地点をクリックするたびに下にある王朝の地図を切り替えます |

### 2. CLI のワンコマンドのスクリーンショットと JSON の検索（エージェントのツール呼び出し用）

```bash
# Single-point poetic landmark screenshot
python3 skills/jiangshan-atlas/scripts/jiangshan.py --year 819 --place 蓝关 --out /tmp/languan_819.png

# Same-year multi-stop trajectory screenshot
python3 skills/jiangshan-atlas/scripts/jiangshan.py --year 763 --place 剑外,巴峡,巫峡,襄阳,洛阳 --out /tmp/dufu_763.png

# Multi-year space-time trajectory screenshot
python3 skills/jiangshan-atlas/scripts/jiangshan.py --year 1079,1080,1094,1097 --place 湖州,黄州,惠州,儋州 --out /tmp/sushi_exile.png
```

### 3. ブラウザーの JavaScript API（`window.atlasAPI`）とブラウザー内の WebMCP（`navigator.modelContext`）

ブラウザーの自動化の環境（Playwright）や、WebMCP に対応した AI ブラウザー（`navigator.modelContext`）では、ページが自動で `jiangshan_locate`、`jiangshan_inspect`、`jiangshan_open_person` を登録し、`window.atlasAPI` を公開します。
- `window.atlasAPI.locate({ year, place, zoom? })`：地図を単一の場所や複数地点の足跡に動かし、構造化された歴史地理のメタデータを返します。
- `window.atlasAPI.inspect({ year, place, person?, stop? })`：読み取り専用の問い合わせで、支配していた勢力、古代の行政区画、現代の省 / 市、区間の距離、人物の出来事、正規の共有用 URL を返します。
- `window.atlasAPI.resolvePlace(place, year?)`：都市、戦略上の峠、詩の名所、戦場の古今の名前を解決します。
- `window.atlasAPI.openPerson(person, stop?)` と `window.atlasAPI.search(query)`：地図上で人物の年代記を開くか、地図全体を検索します。

---

## ローカルで実行する

依存関係もビルドの手順も必要ありません。クローンして、任意の静的な HTTP サーバーで配信します。

```bash
git clone https://github.com/DeanChensj/jiangshan-map.git
cd jiangshan-map
python3 -m http.server 8000
```

その後、ブラウザーで `http://localhost:8000` を開きます。

## Docker で実行する

ローカルの依存関係は必要ありません。Docker Compose でビルドして起動します。

```bash
docker compose up -d --build
```

その後、`http://localhost:8008` を開きます（ポートの対応付け `8008:80` は `docker-compose.yml` で設定されています）。

イメージは、このリポジトリを静的なファイルとして配信する素の `nginx:alpine` です。`Dockerfile` は作業ツリーを `/usr/share/nginx/html` にコピーし、`.dockerignore` は `.git`、`.github`、`data/`、`docs/`、`scripts/`、`skills/`、Markdown ファイル、`geojson/demo.html` を除外して、ビルドのコンテキストを小さく保ちます。サイトは実行時にこれらのどれも必要としません。

別のポートを使うには、`docker-compose.yml` の `ports` の対応付けを変え（例：`"9000:80"`）、もう一度 `docker compose up -d` を実行します。

上流の変更を取り込んだ後は、`docker compose up -d --build` で再ビルドします。Compose を使わない場合：`docker build -t jiangshan-map:latest .` を実行してから `docker run -d -p 8008:80 --name jiangshan-map jiangshan-map:latest` を実行します。

注意：イメージはローカルでビルドするもので、どのレジストリにも公開していません。

---

## GeoJSON のエクスポート（Leaflet / MapLibre / QGIS 用）

アプリは、トポロジーの重複を除いたコンパクトな VLQ のバンドルとしてジオメトリを同梱しています。ほかのプロジェクトでベクターのレイヤーを使うには、標準の RFC 7946 GeoJSON（EPSG:4326、lon/lat）をローカルで生成します。出力は `geojson/` に置かれ、コミットはされません。エクスポートの対象は紀元前 403 年から 1948 年までで、それより後の年と現代の省のレイヤーは含まれません。郡 / 州 / 府のレイヤーは CHGIS に由来し、その条件で再配布が禁止されているため、デフォルトでは出力しません。ローカルでの学術・非商用の利用に限り、`--with-prefectures` を付けると出力できます。その結果は公開しないでください。

```bash
node scripts/export_geojson.js            # or: node scripts/export_geojson.js <outDir>
node scripts/export_geojson.js --with-prefectures   # adds the CHGIS-derived prefecture layer (local academic use only)
```

- `snapshots/<id>.geojson` — 領土の時期ごとに 1 ファイルです。各フィーチャーには `bbox` と `layer`（`polity` / `region`。`--with-prefectures` を付けたときは `prefecture` も）、`title`、`title_en`、`category`、`tint`、`anchor` があります。
- `index.json` — すべての王朝の時期と、その `from` / `to` の年（負の値 = 紀元前、0 年はなし）、対応するスナップショットのファイルです。
- `corridors.geojson`（長城、運河、道路、航路）、`settlements.geojson`、`milestones.geojson`、`neighbors.geojson`、そして `modern/`（河川、湖、水系のラベル。`appear` / `vanish` は、歴史上の河道や湖が表示される年を示します）。

すべての時期を読み込まずに地点を調べるには、[`geojson/jiangshan-locate.js`](geojson/jiangshan-locate.js) を使います。`index.json` と、その年をカバーするスナップショットだけを読み込み、bbox で絞り込んだうえで点がポリゴン内にあるかを判定します。

```js
const atlas = JiangshanLocate.create(); // or create({ base: '<url of geojson/>' })
const hit = await atlas.locate(118.78, 32.06, 1415); // lon, lat, year
hit.polity.properties.title;     // 明
hit.region.properties.title;     // 南直隶
hit.prefecture;                  // null unless exported with --with-prefectures (then 应天府)
```

エクスポートした後、リポジトリを配信し（`python3 -m http.server 8000`）、`http://localhost:8000/geojson/demo.html` を開くと Leaflet の例を見られます。年のスライダーをドラッグしたり、地図をクリックしたり、`demo.html?year=1415&lon=118.78&lat=32.06` を開いて自動で読み込み、強調表示、ズームさせたりできます。歴史上の国境は概略的な近似であり、測量された境界ではありません。データは GPL-3.0 ですが、郡 / 州 / 府レベルの境界は例外です。[データの出典とライセンス](#データの出典とライセンス)をご覧ください。

---

## データの出典とライセンス

コードとこのプロジェクトが作成したデータは **GPL-3.0** で公開しています。例外は 1 つだけで、CHGIS に由来する郡 / 州 / 府レベルの境界は、CHGIS 自身の条件に従います。

| レイヤー | 出典 | ライセンス |
| :-- | :-- | :-- |
| コード（アプリ、スクリプト、CLI、MCP サーバー） | このプロジェクト | GPL-3.0 |
| 政権の領域（`polity`） | [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps)（GPL-3.0）をもとに、史書に照らして手作業で描き直したもの | GPL-3.0 |
| 第一級行政区画（`region`：刺史部 / 道 / 路 / 省 など） | 史書にもとづき手作業で作成。初期版の出典は記録されていません | GPL-3.0 |
| **郡 / 州 / 府レベルの境界**（`prefecture`、戦国と秦の郡を含む） | **CHGIS V6** と **Robert M. Hartwell China Historical GIS** に由来し、0.01° に簡略化して手作業で修正 | **GPL-3.0 ではありません**。学術・非商用の利用に限り、再配布は禁止です。下記を参照 |
| 古地名、主要な出来事、旅程、人物年譜、地名の沿革 | 史書にもとづきこのプロジェクトが整理 | GPL-3.0 |
| 現代の省界 | DataV GeoAtlas（Alibaba Cloud） | DataV GeoAtlas の条件に従う |
| 河川、湖、周辺国 | パブリックドメインのデータ | パブリックドメイン |
| 地形の陰影 | `scripts/build_terrain_tiles.py` が [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（パブリックドメインの **SRTM**、**GMTED2010**、**ETOPO1**）から描画。公開しているのは、解像度が 1 ピクセルあたり約 1 km より細かくない陰影画像だけです | GPL-3.0（画像） |
| 古琴の音声 | Wikimedia Commons（*流水*、*平沙落雁*、*陽関三畳*、*酔漁唱晩*、*酒狂*） | パブリックドメイン |

**参考文献（データの出典ではありません）**：境界は、史書と譚其驤の *The Historical Atlas of China*（谭其骧主编《中国历史地图集》）に照らして確認しています。この地図集の画像やデータは、このリポジトリには含まれていません。

**郡 / 州 / 府レベルの境界（CHGIS）**：このレイヤーは GPL-3.0 の対象外で、このサイトでの非商用・教育目的の表示に使っています。このリポジトリから再公開しないでください。郡州府の境界が必要な場合は、CHGIS の公式配布元（Harvard Dataverse）から、その条件に従って入手してください。`scripts/export_geojson.js` は、`--with-prefectures` を付けて実行しない限り、このレイヤーを出力しません。引用形式：*CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.* 出典の詳細は [data/atlas/README.md](data/atlas/README.md) をご覧ください。

**おおよその境界**：この地図の歴史上の領域と行政境界は、おおまかな管轄を示す概略的な近似です。科学的な測量によるものではなく、正確な、あるいは権威ある境界として引用しないでください。

**このプロジェクトの再利用**：GPL-3.0 のレイヤーを再利用するときは、https://github.com/DeanChensj/jiangshan-map へのリンクとともに **江山时序 Jiangshan Atlas** のクレジットを記し、上に挙げた出典も引用してください。郡州府レイヤーが写っているスクリーンショットにも、CHGIS の条件が適用されます。

**権利者の方へ**：このリポジトリの内容について権利をお持ちで、不適切な利用だとお考えの場合は、[issue](https://github.com/DeanChensj/jiangshan-map/issues) でお知らせください。確認のうえ対応し、必要に応じて削除します。

**コントリビュート**：リポジトリの構成、データの規約、検証のチェックについては [CONTRIBUTING.md](CONTRIBUTING.md)（[中文贡献指南](CONTRIBUTING_ZH.md)）をご覧ください。

**データの誤りの報告**：年代・地名・記述の誤りを見つけたら、[データ修正の issue](https://github.com/DeanChensj/jiangshan-map/issues/new?template=data-error.yml) を作成してください。出典があれば添えてください。

Copyright © 2026 DeanChensj. 上記の例外を除き、GPL-3.0 で公開しています（[LICENSE](LICENSE) をご覧ください）。
