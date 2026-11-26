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

### 其他功能

| 參考 | 功能 |
|---|---|
| Anki | 複習翻卡用「重來／困難／良好／簡單」自評 |
| WaniKani | 羅馬拼音即時轉假名；學徒→熟練→精通→燒錄四個等級 |
| Bunpro | 25 個 N5 文法點，學會後加入填空複習 |
| Tofugu | 平假名記憶口訣 |
| 手寫練習 | 每個假名都有描字畫板 |

另外還有：系統日文語音朗讀、振假名、深色無印良品色調 liquid glass 介面、鍵盤快捷鍵（1–4 選答案、Enter 確認、Space 翻卡）。

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

## 本機執行

直接用瀏覽器開 `index.html` 就能用（離線快取只在 http/https 下啟用）。或者：

```powershell
python -m http.server 8000
```

## 注意

- 學習進度只存在瀏覽器的 localStorage，不會上傳；換瀏覽器或清除網站資料就會從頭開始。
- 沒有設定頁：固定深色無印良品色調的 liquid glass 介面、顯示振假名、作答後自動發音、每日小目標 50 XP。
- 發音使用作業系統的日文語音。Windows 可到「設定 → 時間與語言 → 語音」加裝日文語音；iOS / Android 通常已內建。
