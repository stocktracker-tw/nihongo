# 日語道場 Nihongo Dojo

純 HTML / CSS / JavaScript 的日語學習網頁 App，不需要後端、不需要建置，直接放上 **GitHub Pages** 就能用，也可以安裝成手機 App（PWA）離線使用。

## 綜合各家 App 的優點

| 參考來源 | 在這裡的功能 |
|---|---|
| **Anki** | SM-2 間隔重複演算法；翻卡後用「重來／困難／良好／簡單」自評，按鈕上會顯示下次複習間隔 |
| **WaniKani** | 輸入框打羅馬拼音自動轉成假名（`nn`→ん、`kka`→っか、`-`→ー）；學徒／熟練／精通／燒錄四個等級；先上課再測驗，答錯的題目當場再出一次 |
| **Duolingo** | 每日 XP 目標圓環、連續天數 🔥、三顆愛心的快速挑戰、連擊加分、拼字塊造句 |
| **Bunpro** | 25 個 N5 文法點：句型結構、說明、例句，學會後加入填空複習 |
| **Tofugu / Kana 類 App** | 平假名、片假名、濁音、拗音表；記憶口訣；依錯誤率加權出題 |
| **手寫練習 App** | 每個假名都有描字畫板，可以開關範本 |
| **GitHub** | 學習足跡熱力圖 |

其他：瀏覽器內建語音朗讀（ja-JP）、振假名開關、深色模式、鍵盤快捷鍵（1–4、Enter、Space）、進度匯出／匯入 JSON。

## 內容

- 五十音：清音 46、濁音／半濁音 25、拗音 33（平假名與片假名）
- N5 單字約 200 個，分為問候、人物、數字、時間、地點、飲食、物品、自然、身體、動詞、形容詞、疑問、指示
- N5 文法 25 個、造句題 15 句

資料都在 [`js/data.js`](js/data.js)，照格式新增單字、文法或句子即可擴充。

## 部署到 GitHub Pages

```powershell
git init
git add .
git commit -m "Nihongo Dojo"
git branch -M main
git remote add origin https://github.com/<你的帳號>/nihongo-dojo.git
git push -u origin main
```

到 repo 的 **Settings → Pages**，Source 選 `main` 分支、`/ (root)`，幾分鐘後網址就是 `https://<你的帳號>.github.io/nihongo-dojo/`。

## 本機執行

直接用瀏覽器開 `index.html` 就能用（離線快取只在 http/https 下啟用）。或者：

```powershell
python -m http.server 8000
```

## 注意

- 學習進度只存在瀏覽器的 localStorage；換裝置請用「設定 → 匯出／匯入」。
- 發音使用作業系統的日文語音。Windows 可到「設定 → 時間與語言 → 語音」加裝日文語音；iOS / Android 通常已內建。
