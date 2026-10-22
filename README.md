# iPAS AI 應用規劃師（初級）主題地圖

以 3D 島嶼地圖整理 iPAS AI 應用規劃師初級的考試範圍，並在每個主題概念下提供練習題；練習越多，島上的城鎮越繁榮。

> 本專案為個人製作的練習工具，與 iPAS 主辦單位無關，內容不代表官方立場。考試範圍與規定請以官方最新公告為準。

- 線上練習：<https://beautifulinda.github.io/ipas/>
- 狀態：開發中（Phase 1）

## 解決的問題

準備考試時，條列式講義看不出各主題之間的關係，刷題網站則看不出自己在整體範圍中的弱項。本專案把考試範圍做成三層的島嶼地圖，學習進度直接顯示在地圖上，換言之，打開地圖就知道哪一區還沒讀、哪一區常答錯。

## 功能

### 主題地圖：島嶼（三層）

| 層級 | 地圖上的樣子 |
| --- | --- |
| 科目（兩個科目） | 一座島，每座島有不同的配色主題 |
| 大知識分類 | 島上的地區 |
| 主題概念 | 地區裡的城鎮（小房子），以及（可選）練習題 |

- 3D 低多邊形地圖：島有沙灘、岩壁與高低不同的草地台階，島上有大山、山丘與樹林，海面會起伏。
- 島與地區的面積目前依底下的主題概念數量分配；形狀與裝飾位置以 ID 為種子產生，每次開啟都相同。
- 點擊島、地區或城鎮後鏡頭平滑飛過去，上方麵包屑可隨時返回上一層。
- 文字標籤自動排版、互不重疊，以看得清楚為優先。

### 探索與成就

| 進度 | 地圖上的變化 |
| --- | --- |
| 地區還沒練習 | 蓋著一層白霧與雲 |
| 概念作答過 | 城鎮從工地變成帳篷 |
| 概念半數以上答對 | 帳篷升級為房子 |
| 概念全部答對（最近一次） | 房子升級為城堡 |
| 地區的概念全部是城堡 | 插上旗子 |
| 整座島的地區都插旗 | 燈塔亮起、光束旋轉 |

- 每次升級都會放煙火：升級為帳篷、房子時跳出恭喜訊息，達成城堡、插旗、點亮燈塔時出現「里程碑達成」匾額。
- 城鎮名稱旁的圓餅顯示答對題數，題目多的主題也看得到每一題的進展。
- 第一次打開時，第一個有題目、還沒練習的城鎮上方會標示「從這裡開始」，點一下就直接開始練習。

### 依裝置切換檢視方式

| 項目 | 桌面版 | 手機版 |
| --- | --- | --- |
| 地圖瀏覽 | 整張地圖，滾輪縮放、拖曳平移 | 同一張地圖，點擊逐層放大；直式螢幕時島改為上下排列 |
| 返回上一層 | 麵包屑、Esc 鍵、瀏覽器上一頁 | 左上角返回按鈕、系統返回手勢（iPhone 左緣右滑、Android 返回鍵） |
| 概念說明 | 右側面板，地圖保持可見 | 底部滑出面板（bottom sheet） |
| 練習作答 | 右側面板內作答 | 全螢幕作答 |
| 其他操作 | 方向鍵切換同層節點、滑鼠懸停提示 | 觸控目標至少 44px |

裝置判斷同時參考螢幕寬度與輸入方式（`pointer: coarse`），讓以觸控操作的平板也能套用手機版操作。另提供清單模式，可在地圖與清單間切換。地圖位置會同步到網址（`?at=節點ID`），可以直接分享某個主題。

### 練習與進度

- 依主題練習，作答後立即顯示解析
- 錯題本與作答紀錄，存於使用者瀏覽器；答錯的題目進入錯題本，之後答對時詢問是否移除，由使用者決定
- 匯出、匯入學習紀錄（JSON 檔），供使用者自行在不同裝置間轉移
- 模擬考模式：計時、計分、各主題答對率
- 節點依學習狀態顯示顏色：未練習、答對率高、常答錯

## 隱私設計

本專案採本機優先（local-first）設計，原則是不在伺服器保存可識別使用者的資料。

| 資料 | 存放位置 | 說明 |
| --- | --- | --- |
| 錯題本（含移除紀錄）、作答紀錄、學習進度 | 使用者瀏覽器（IndexedDB） | 不上傳；清除瀏覽器資料後即消失，建議定期匯出 |
| 各題答對、答錯次數 | Supabase | 匿名統計，僅記錄題目 ID 與對錯，不記錄使用者身分 |
| 題目錯誤回報 | Supabase | 僅記錄題目 ID 與回報內容，不要求聯絡方式 |

- 目前不提供登入功能，不收集姓名、Email 等個人資料。
- 網站提供隱私說明頁，列出上述存放內容。

## 題目來源原則

- 網站有兩種題目，每題都會標示：
  - **官方公告試題**：iPAS 公告的歷屆試題（目前 4 個梯次、400 題），每題標示出處（梯次、考科、題號）並連到 [iPAS 官網學習資源頁](https://ipd.nat.gov.tw/ipas/certification/AIAP/learning-resources)。題目全文照官方公告，不改作，也不轉載他人撰寫的解析；沒有解析的題目顯示「答案依 iPAS 官方公告」。
  - **自編題**：作者依官方公開的評鑑範圍與學習指引自行撰寫，可使用 LLM 輔助產生草稿，所有題目皆經人工審核後才納入題庫。
- 公開官方公告試題的依據：iPAS 能力鑑定小組 2026-10-21 回信，網站不收費、無廣告，每題註明梯次與出處並附連結，在符合著作權法合理使用的前提下「原則上不予限制」。
- 試題著作權屬經濟部產業人才能力鑑定（iPAS），僅供個人學習練習，不得重製或作為營利用途。官方要求時立即下架。
- 官方公告試題不放在這個公開 repo，而是放在私人 repo，部署時由 GitHub Actions 讀入；部署前會比對這個 repo 的所有檔案與提交，確認沒有任何一題的題目文字。
- 同一題在不同場次考過時只出現一次，出處列出每一次並標示「考過 N 次」。
- 科目、分類與概念的資料來源為經濟部產業人才能力鑑定（iPAS）官網〈AI 應用規劃師能力鑑定 評鑑內容範圍參考〉（115.02 更新）。
- 每題標註來源類型（`original`、`official-link` 或 `official-past`）。

## 與 AI 協作的方式

本專案以 Claude Code 協作開發，提交紀錄中的 `Co-Authored-By` 即為標示。程式實作主要由 Claude Code 撰寫，作者負責需求、設計決策、審查與驗收：

- 需求、設計方向與取捨由作者決定，例如地圖從 SVG 改為 3D、題庫分類採官方 115.02 版評鑑範圍、官方公告試題確認授權後才公開（並放在私人 repo）。
- 決策與脈絡寫在 [`CLAUDE.md`](CLAUDE.md)，每次開工時 AI 依此執行，避免偏離已確定的方向；新的決策會附上日期記回檔案。
- 練習題可由 LLM 產生草稿，但必須經作者逐題審核答案與解析（`npm run review`），CI 會擋下未審核的題目。
- 涉及授權與法規的判斷（例如官方試題能否公開）不由 AI 推定，而是查證來源並向主辦單位書面確認。

## 測試

功能需求以中文 Gherkin（假設／當／那麼）寫在 [`tests/features/`](tests/features/)，每個功能都包含正常流程與例外流程。需求檔本身就是測試：由 [quickpickle](https://github.com/dnotes/quickpickle) 對應到步驟定義後在 Vitest 執行，需求與程式行為不一致時測試會失敗。

需要在真的瀏覽器裡操作的場景標上 `@e2e`，改由 Playwright（透過 [playwright-bdd](https://github.com/vitalets/playwright-bdd)）在桌面 Chrome、Android（Chromium）、iPhone（WebKit）三種環境執行。E2E 用 [`tests/e2e/fixtures/map.json`](tests/e2e/fixtures/map.json) 的假題庫建置網站，不讀私人題庫；需求檔背景裡的主題表格必須和假題庫一致。

```gherkin
場景: 城堡的題目後來答錯，降回房子
  假設 「模型評估」已經是城堡
  當 我再作答第 2 題並答錯
  那麼 「模型評估」降回房子
  而且 不會再放一次煙火
```

底層的純函式另有單元測試（`tests/unit/`）。CI 在題庫檢查、型別檢查與所有測試都通過後才部署。

## 系統架構

```
[題庫 JSON]＋[私人 repo：官方公告試題] ──> [GitHub Actions：題庫檢查、型別檢查、測試] ──> [nuxt generate] ──> [GitHub Pages]
                                                                                     │
                                                         （Phase 2）[Supabase：匿名答題統計、題目回報]
```

- GitHub Pages 僅提供靜態網站，前端不直接呼叫 LLM，避免 API key 外洩。
- LLM 輔助出題在本機或 CI 中執行，產出結果寫入題庫 JSON，經審核後提交。
- Phase 2 接入 Supabase 時，前端僅使用 anon key，所有資料表啟用 RLS：匿名資料表只允許新增、不允許讀取原始資料，統計數字一律透過彙總後的 view 或資料庫函式取得，並設有寫入頻率限制。

## 技術選型

- 前端：Nuxt 3、Vue 3、TypeScript
- 地圖：Three.js（3D）；版面計算用 D3（d3-hierarchy、d3-polygon、d3-shape）、d3-voronoi-treemap（地區切割）、polygon-clipping
- 裝置判斷與尺寸：VueUse（`useMediaQuery`、`useElementSize`）
- 測試：Vitest（資料與邏輯）、Playwright（手機與桌面尺寸 E2E）
- 部署：GitHub Actions、GitHub Pages
- 本機儲存：IndexedDB
- 後端（Phase 2）：Supabase（PostgreSQL、RLS）

## 資料結構

題庫在 [`data/map.json`](data/map.json)，型別定義見 [`types/map.ts`](types/map.ts)。科目、分類與概念依官方〈AI 應用規劃師能力鑑定 評鑑內容範圍參考〉（115.02 更新），ID 直接使用官方代碼（如 `L11302`）。

### 題目審核流程

1. 練習題草稿放在 `data/drafts/questions.draft.json`，網站不會讀取。
2. 執行 `npm run review`（或 `npm run review -- L113` 只審某一部分），逐題先作答、再看答案與解析，決定通過或標記待修改。
3. 通過的題目會移到 `data/map.json` 並標記 `reviewed: true`。
4. 執行 `npm run validate` 檢查格式；正式題庫中若有未審核的題目，檢查會失敗。

```
Subject（科目）
└── Category（大知識分類）
    └── Concept（主題概念）
        └── Question[]（練習題，可為空陣列）
```

## Roadmap

### Phase 1：靜態版上線

- [x] 建立 Nuxt 3 專案，設定 `nuxt generate` 與 GitHub Actions 部署流程
- [x] 部署至 GitHub Pages
- [x] 定義資料結構與型別，建立範例資料
- [x] 桌面版地圖：島嶼地圖、點擊縮放、拖曳、麵包屑、鍵盤操作
- [x] 手機版地圖：返回按鈕、右滑手勢（系統返回手勢）、bottom sheet、全螢幕作答、清單模式
- [x] 概念卡片與練習題作答
- [x] 作答紀錄與錯題本存於瀏覽器（IndexedDB）
- [x] 學習紀錄匯出、匯入（JSON）
- [ ] 隱私說明頁
- [x] CI：題庫格式檢查、型別檢查、單元測試（Vitest），任何一項失敗就不部署
- [x] Playwright 手機與桌面 E2E 測試（目前涵蓋「從這裡開始」）

### Phase 2：互動功能

- [ ] Supabase 匿名答題統計（RLS：僅新增，透過彙總 view 讀取）
- [ ] 各題答錯率顯示
- [ ] 題目錯誤回報與後台審核
- [ ] 寫入頻率限制

### Phase 3：擴充

- [ ] 模擬考模式
- [ ] LLM 輔助出題流程，含答案與出處自動驗證

## 本機開發

```bash
npm install
npm run dev        # 開發伺服器
npm run typecheck  # 型別檢查（vue-tsc）
npm run validate   # 題庫檢查
npm run review     # 逐題審核練習題草稿
npm run generate   # 產生靜態網站
npm start          # 產生靜態網站並在 http://localhost:4173/ipas/ 預覽
npm test           # 單元測試與需求測試（Vitest）
npm run e2e:build  # 用假題庫產生 E2E 測試用的網站（第一次要先 npx playwright install chromium webkit）
npm run e2e        # E2E 測試（Playwright）
```

官方公告試題放在私人 repo `ipas-past-papers`，本機 clone 到 `data/private/`（已列入 `.gitignore`）。檔案存在時，`npm run dev`、`npm start` 與 `npm run validate` 會一併載入與檢查；不存在時網站只有自編題。

新增一個梯次的試題：

1. 用 markitdown 把官方 PDF 轉成 Markdown，放進試題資料夾。
2. 執行 `node scripts/import-past-papers.mjs <試題資料夾> data/private/past-papers.concepts.json`，輸出 `data/private/past-papers.json`；新題目在概念對照檔補上所屬主題。
3. 執行 `npm run validate`，確認出處、考科與主題對得上。
4. 在 `data/private/` 裡 commit 並推送到私人 repo，再重新執行部署（GitHub Actions 的 workflow_dispatch）。

## 授權

程式碼：MIT（待定）
題庫內容：待定
