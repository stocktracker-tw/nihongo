# Nihongo

純 HTML / CSS / JavaScript 的日語學習網頁 App，不需要後端、不需要建置，直接放上 **GitHub Pages** 就能用，也可以安裝成手機 App（PWA）離線使用。

線上版：https://stocktracker-tw.github.io/nihongo/

## 學 Duolingo，但不情勒

學習方式照 Duolingo：**單元 → 課**的學習路徑、每課 3 分鐘左右、多種題型混合、單元指南。
但拿掉了讓人有壓力的機制：

| Duolingo 會這樣 | 這裡改成 |
|---|---|
| 連續天數，斷掉就歸零 | **累積學習天數**和**本週學了哪幾天**，休息不會扣掉任何東西 |
| 答錯扣愛心，愛心用完就不能學 | 沒有愛心。答錯的題目會在課程最後再出一次 |
| 前面沒過就鎖住後面的課 | 不鎖課，想跳著學都可以（只會溫和建議順序） |
| 吉祥物推播催你、讓你有罪惡感 | 吉祥物クロ（也是 App 圖示）長得兇，但只說鼓勵的話，不推播 |
| 排行榜、聯賽 | 沒有。只跟自己比 |
| 每日目標必須達成 | 小目標可以設為「不設目標」，達成了也會說「接下來隨你」 |

### 課程內容（11 個單元）

平假名 1、平假名 2 → 打招呼 → 自我介紹 → 吃吃喝喝 → 這是什麼 → 片假名 → 在哪裡 → 時間 → 日常動作 → 形容一下

### 題型

教學卡（emoji + 讀音 + 發音）、看圖選字、選意思、聽音選字、配對、日翻中拼字塊、中翻日拼字塊、聽寫拼字塊、打字作答（羅馬拼音自動轉假名）。

課程學到的單字會自動加入 **間隔重複複習**（Anki 的 SM-2 演算法），在快忘記的時候出現。

### 單字書（N5～N1，學習方式仿「識日」）

JLPT N5～N1 共 8,027 個單字，每個都有中文意思和 Azure 發音。

- 選一本當作目前在背的書，每天先複習到期的字，再學新字（每日新詞 5／10／20／30）
- 每張卡先自己回想，按「認識／模糊／不認識」，再看答案；按「認識」的要再確認「記對了／記錯了」
- **洗腦循環**：沒記住的字在這一輪會一直回來，直到你說「認識」
- **已掌握**：已經會的字直接標記，以後不再出現
- 一輪結束後用**連連看**和**聽寫**鞏固
- 可以查單字（漢字、假名、羅馬拼音、中文都能查）
- **例句**：N5～N1 全部 8,027 個字都有一句例句（附中文翻譯和發音），翻卡時一起出現
- **動詞變化**：動詞會列出ます形、て形、ない形、た形、可能、意向等變化
- **批次管理**：在單字列表勾選多個字，一次標為已掌握、取消或重新學
- **句子隨身聽**：把今天學的字、正在學的字或整本書連續播放（單字＋例句），可設定重複次數、隨機順序，鎖螢幕也能控制

例句寫在 `tools/ex/*.tsv`（格式：`id<TAB>日文<TAB>中文`）。

單字表來源：[open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)（MIT），原始資料 [tanos.co.uk](http://www.tanos.co.uk/jlpt/)（Jonathan Waller，CC BY）。原始檔在 `vendor/jlpt/`，中文釋義在 `tools/zh/`，用 `python -I tools/build_vocab.py` 產生 `data/jlpt/*.json`。

### 其他功能

| 參考 | 功能 |
|---|---|
| Anki | 複習翻卡用「重來／困難／良好／簡單」自評 |
| WaniKani | 羅馬拼音即時轉假名；學徒→熟練→精通→燒錄四個等級 |
| Bunpro | 25 個 N5 文法點，學會後加入填空複習 |
| Tofugu | 平假名記憶口訣 |
| 手寫練習 | 每個假名都有描字畫板 |

另外還有：Azure 真人感日文發音、振假名、深色無印良品色調 liquid glass 介面、鍵盤快捷鍵（1–4 選答案、Enter 確認、Space 翻卡）。

課程內容在 [`js/course.js`](js/course.js)，單字庫與文法在 [`js/data.js`](js/data.js)，照格式新增即可擴充。

## 部署到 GitHub Pages

```powershell
git init
git add .
git commit -m "Nihongo"
git branch -M main
git remote add origin https://github.com/<你的帳號>/nihongo.git
git push -u origin main
```

到 repo 的 **Settings → Pages**，Source 選 `main` 分支、`/ (root)`，幾分鐘後網址就是 `https://<你的帳號>.github.io/nihongo/`。

## 發音檔（Azure 語音）

發音檔放在 `audio/`，檔名是文字的雜湊值，`audio/index.json` 是清單。新增課程、單字或句子之後要重新產生：

1. 用瀏覽器打開 `tools/collect.html`（要透過本機伺服器，例如 `python -m http.server`），下載 `texts.json` 和 `hints.json`，放到 `tools/`。
2. 設定環境變數 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`，然後執行：

```powershell
python tools/gen_audio.py
```

只會重做有變動的檔案：新文字、念法改了、或換了聲音。清單裡已經沒有的舊檔會被刪掉。金鑰只在你的電腦上使用，不會寫進任何檔案或網頁。

念法怎麼決定（`tools/gen_audio.py`）：
- 單字和文法例句送給 Azure 時用漢字寫法（`hints.json`），讓它分辨同音字、音調才對，例如 あめ→雨、はな→花、やさしい→易しい。讀音有歧義的漢字（數字、今日、人、年、何…）維持假名。
- 單獨一個平假名改用片假名念，避免 は・へ・を 被念成助詞。
- 容易念錯的漢字指定讀音：明日→あした、昨日→きのう、今→いま、行く→いく、私→わたし、九時→くじ 等。
- 三拍以內的短音（單一假名、兩三拍的詞）用標準版 Nanami，句子和較長的詞用 Nanami HD：HD 遇到極短的輸入常會拖音或多念雜音。

產生後可以用 `python tools/check_audio.py` 檢查：它會量每個檔實際說話的長度，太長的再用 Azure 語音辨識聽它說了什麼（需要 ffmpeg）。

## 本機執行

直接用瀏覽器開 `index.html` 就能用（離線快取只在 http/https 下啟用）。或者：

```powershell
python -m http.server 8000
```

## 注意

- 學習進度只存在瀏覽器的 localStorage，不會上傳；換瀏覽器或清除網站資料就會從頭開始。
- 沒有設定頁：固定深色無印良品色調的 liquid glass 介面、顯示振假名、作答後自動發音、每日小目標 50 XP。
- 發音是 Azure 語音 Nanami（句子用 HD 版、短音用標準版，都調成成熟的大姊姊聲線）預先產生的 mp3，每台裝置聽到的都一樣；播過一次就會存進離線快取。少數不在清單裡的文字才會改用裝置內建語音。
