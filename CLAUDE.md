# CLAUDE.md

本檔提供 Claude Code 在此 repo 工作時需要的專案脈絡與已確定的決策。功能、架構與 roadmap 的完整說明見 `README.md`。

## 專案概要

- iPAS AI 應用規劃師（初級）的主題地圖與練習網站，個人 side project，公開作為作品展示。
- Repo：`beautifulinda/ipas`，部署網址：`https://beautifulinda.github.io/ipas/`
- 非官方工具，頁面與 README 都必須註明與 iPAS 主辦單位無關。

## 已確定的決策

- 技術：Nuxt 3、Vue 3、TypeScript；地圖用 Three.js（3D 低多邊形，2026-10-20 由作者決定從 SVG 改為 3D），版面計算用 D3（d3-hierarchy、d3-polygon、d3-shape）加 d3-voronoi-treemap、polygon-clipping；裝置判斷與尺寸用 VueUse（`useMediaQuery`、`useElementSize`）。
- TypeScript 固定 5.9：7.x 與 vue-tsc 不相容。型別檢查用 `npm run typecheck`。
- 部署：`nuxt generate` 產生靜態網站，GitHub Actions 部署到 GitHub Pages。
- 子路徑部署：`nuxt.config.ts` 必須設定 `app.baseURL: '/ipas/'`，否則上線後靜態資源路徑錯誤。
- 資料：題庫與地圖結構集中在 `data/` 的 JSON，型別定義在 `types/map.ts`。三層結構為 科目 → 大知識分類 → 主題概念（`questions` 可為空陣列）。
- 地圖設計（2026-10-20 定案）：3D 低多邊形島嶼地圖（`components/IslandMap3D.vue`）。
  - 科目＝島、大知識分類＝島上地區（高低不同的草地台階）、主題概念＝城鎮。
  - 版面（海岸線、地區切割、城鎮與山林位置）由 `utils/islandLayout.ts` 以 ID 為種子產生，3D 場景在 `utils/scene/`。
  - 文字標籤是疊在畫面上的 HTML，圓角樣式、以看得清楚為優先，每格畫面重新排版避免重疊。
  - 成就感（`utils/progression.ts`）：城鎮依熟練度從工地 → 帳篷 → 房子 → 城堡；沒練習過的地區蓋白霧與雲；地區內有題目的概念全是城堡就插旗；島上全部插旗則燈塔亮起；達成時放煙火並跳出解鎖訊息。
  - 作者 2026-10-21 審〈城鎮升級〉需求後決定：剛好一半算房子、沒作答算沒答對、城堡會降級（降級不放煙火）都維持。同日加入（需求在 `tests/features/從這裡開始.feature`、`練習回饋.feature`）：依官方順序第一個有題目、還沒練習的城鎮顯示「從這裡開始」，點了直接前往並顯示題目（手機開全螢幕作答）；工地放大 1.5 倍；雲半透明（不擋住工地）、地面薄霧；城鎮標籤旁的進度圓餅（答對／題數）；每次升級都放煙火——帳篷、房子跳「🎉 恭喜升級了，你超棒！」，城堡、插旗、燈塔出現置中的「里程碑達成」匾額；一次升好幾級只算最高一級，降級不放煙火。題目回報延到第二階段。
  - 作者 2026-10-22 審〈升級演出〉時推翻「全錯也升級為帳篷」：至少答對 1 題才是帳篷，全部答錯維持工地（雲霧照樣散開）；「從這裡開始」改看有沒有作答過，不看等級。題數 1～2 的主題不會出現帳篷（答對 1 題就是一半）。
  - 「掌握」的定義：該概念所有題目的最近一次作答都答對。沒有題目的概念視為未完成（題庫補齊前，該地區不會插旗、島不會亮燈）。
  - 面積目前依概念數量分配；是否改依考古題比重尚未決定。
  - 不支援 WebGL 時自動改用清單模式；系統開啟減少動態效果時關閉海浪、煙火與鏡頭飛行。
  - 其他嘗試過的版本保留在分支：`pixel-style`（像素風 SVG）、`island-natural-style`、`treemap-layout`、`circle-pack-layout`。
  - web3：2026-10-20 作者詢問，評估後目前不納入規劃（與隱私原則衝突、對備考沒有幫助）；作者尚未做最終決定。
- 裝置分流：
  - 桌面：整張地圖縮放與拖曳、右側面板、鍵盤操作（Esc 返回、方向鍵切換同層）。
  - 手機：同一張島嶼地圖，點擊逐層放大（一次聚焦一層）、返回按鈕與右滑手勢、bottom sheet、全螢幕作答、觸控目標至少 44px。直式螢幕時島改為上下排列。
  - 判斷同時參考寬度與 `pointer: coarse`，並提供清單模式。
- 隱私：本機優先（local-first）。錯題本、作答紀錄、學習進度只存在使用者瀏覽器（IndexedDB），提供 JSON 匯出、匯入。目前不做登入，不收集個人資料；作者 2026-10-21 表示這是暫時的階段，之後想加入登入（做法與隱私原則如何調整尚未決定）。
- Supabase（Phase 2）只存匿名答題統計（題目 ID 與對錯）與題目回報。前端只用 anon key；匿名資料表 RLS 設為只能新增、不能讀取原始資料，統計透過彙總 view 或資料庫函式取得，並加寫入頻率限制。
- 前端不得直接呼叫 LLM，也不得出現任何 API key 或 Supabase service_role key。

## 題目與內容規則

- 不轉載官方樣題、考題全文或他人撰寫的解析到公開 repo；官方內容只放連結。他人撰寫的解析一律不轉載，不把考古題改寫成自己的題目。
- 官方公告試題（考古題）：作者 2026-10-22 決定公開到網站（需求在 `tests/features/考古題出處.feature`），推翻 2026-10-21「只在本機練習」的決定。
  - 依據：iPAS 能力鑑定小組 2026-10-21 兩封回信。第一封說公開考題「僅供個人學習及教學參考，不得重製、改作，或作為付費題庫與商用教育應用程式等營利用途」；作者追問「不收費、無廣告、每題註明梯次與出處並附連結，放在公開網站供考生練習，是否屬於不得重製」，第二封回「使用者在明確標示出處來源，且符合著作權法『合理使用』原則之前提下，原則上不予限制」。
  - 因此網站必須維持不收費、無廣告（Roadmap 的贊助連結已拿掉）；每題顯示出處「114 年第四次 第一科 第 1 題」與全站共用的 iPAS 官網學習資源頁連結（`utils/pastPapers.ts` 的 `PAST_PAPERS_URL`）；頁尾與 README 有著作權聲明；題目全文照官方，不改作；沒有解析時顯示「答案依 iPAS 官方公告」（解析之後再決定要不要自己寫，自己寫也要經過審核）。
  - 存放：題目放在私人 repo `beautifulinda/ipas-past-papers`，本機 clone 到 `data/private/`（列在 `.gitignore`），部署時 GitHub Actions 用 deploy key（secret `PAST_PAPERS_DEPLOY_KEY`）讀入。公開 repo 不放題目，避免整理好的題庫被一鍵下載、也才能下架。需求檔、測試、檢查規則留在公開 repo，測試只用自己編的假題目，不可複製任何一句真題。
  - 用詞：「科目」是地圖上的島（L11、L12）；「考科」是考試的第一科、第二科（第一科只能放 L11 的主題，第二科只能放 L12）。出處存成 `source.exams: [{ session: '114-S4', paper: 1, number: 1 }]`。
  - 同一題在不同場次考過（忽略標點、空白、全形半形與選項順序，答案比選項文字）只出現一次，沿用最早那次的 ID，出處列出每一次並標「考過 N 次」；官方答案不一致時檢查失敗，等作者確認。
  - `npm run validate`：出處缺梯次／考科／題號、放錯島、出處重複、同一題答案不一致都會失敗；比對公開 repo 所有檔案與提交，出現考古題題目文字就失敗；部署時加 `--require-private`，讀不到私人題庫就部署失敗（網站維持上一版，不會變成沒有考古題的版本）。
  - 下架：從私人 repo 拿掉題目再重新部署。使用者瀏覽器的作答紀錄保留（重新上架時接得回來），錯題本與統計只算網站上還有的題目，「學習紀錄」顯示「有 N 題已下架…」。題庫新增考古題造成城鎮降級時，打開網站顯示一次「某主題新增了 N 題考古題」，不放煙火。
  - 匯入：`node scripts/import-past-papers.mjs ~/Vault/Sources/PDF data/private/past-papers.concepts.json`，輸出 `data/private/past-papers.json`；概念對照檔由 Claude 逐題判斷，可再調整。新增梯次的流程寫在 README〈本機開發〉。
  - 同一封回信要求：參考評鑑內容、學習指引規劃學習架構時，須留意版本與適用性，並註明資料來源為「經濟部產業人才能力鑑定（iPAS）官網」。頁首免責聲明旁已顯示 `scopeSource`，官方改版時要更新版本。
- 題目為自行撰寫，可用 LLM 產生草稿，人工審核後才把 `reviewed` 設為 `true`。CI 必須擋下 `reviewed: false` 的題目。
- 每題標註 `source.type`（`original`、`official-link` 或 `official-past`）；網站分別標示「自編題」「官方樣題（連結）」「官方公告試題」，考古題依梯次由新到舊排在前面，自編題排最後。
- 科目、分類、概念依官方〈AI 應用規劃師能力鑑定 評鑑內容範圍參考〉115.02 更新版（作者 2026-10-20 確認採用）：分類＝評鑑主題（如 L113），概念＝評鑑內容（如 L11302），ID 直接用官方代碼，來源記在 `data/map.json` 的 `scopeSource`。官方改版時以新版為準，不要自行補上猜測內容。
- 題目流程：草稿放 `data/drafts/questions.draft.json`（網站不讀取，`reviewed: false`）→ 作者用 `npm run review` 逐題作答並審核 → 通過的題目移到 `data/map.json` 並設為 `reviewed: true`。`npm run validate` 會擋下正式題庫中未審核的題目。
- 概念說明（summary、keyPoints）由 Claude 依官方範圍撰寫，作者可直接修改。
- 介面文字、README、註解一律使用正體中文。

## 目前進度與下一步（Phase 1）

1. ✅ 建立 Nuxt 3 專案，設定 baseURL 與 GitHub Actions 部署流程。2026-10-21 已推送到 GitHub 並部署到 Pages（只推 `main`；提交作者信箱改用 GitHub noreply，本機 git 設定已改，舊提交保留在本機分支 `backup/before-rewrite`，不推送）。
2. ✅ 讀取 `data/map.json`，完成桌面版地圖（島嶼地圖）的點擊縮放、麵包屑與鍵盤操作。
3. ✅ 手機版：返回按鈕、bottom sheet（可拖曳展開／收起／關閉）、全螢幕作答、觸控目標 44px、清單模式。
   - 右滑手勢靠瀏覽器歷史紀錄實現：地圖位置同步到網址 `?at=節點ID`（`composables/useFocusHistory.ts`），iPhone 左緣右滑、Android 返回鍵都會回上一層。
   - 必須透過 vue-router（頁面在 `pages/index.vue`），不可直接呼叫 `history.pushState`：Nuxt 的簡易路由在有 baseURL 時處理上一頁會把網址疊成 `/ipas/ipas/`。
   - 裝置判斷在掛載後才生效（`composables/useDevice.ts`），避免靜態 HTML 與 hydration 不一致。
4. ✅ 概念卡片與練習題作答、作答紀錄存 IndexedDB（`composables/useRecords.ts`）、錯題本、匯出匯入（格式與合併邏輯在 `utils/progress.ts`）。
   - 錯題本規則（作者 2026-10-21 決定，需求在 `tests/features/錯題本.feature`）：答錯進入錯題本；答對不自動移出，而是詢問「這題答對了，要從錯題本移除嗎？」，使用者選「移除」才移出；移除後又答錯會重新進入；錯題本與城鎮等級無關。
   - 移除紀錄存在 IndexedDB 的 `dismissals`（資料庫版本 2，從版本 1 升級會保留舊作答紀錄）；匯出檔版本 2 含 `dismissals`，仍可匯入版本 1。
5. CI：✅ JSON 格式與 `reviewed` 檢查、型別檢查、Vitest 單元測試（`tests/unit/`，只測 `utils/` 的純函式，`npm test`）、Playwright E2E，全部通過才部署；PR 只跑檢查不部署。
   - 需求測試（作者 2026-10-21 決定）：功能需求用正體中文 Gherkin（`# language: zh-TW`，假設／當／那麼／而且／但是）寫在 `tests/features/*.feature`，每個功能都要有 Happy Path 與 Sad Path，用詞要讓作者不看程式碼就能審。由 quickpickle 在 Vitest 執行，步驟定義在 `tests/features/*.steps.ts`（要加進 `vitest.config.ts` 的 `setupFiles`）。新的需求檔先給作者審過再實作步驟。
   - E2E（2026-10-22）：`playwright-bdd` 讀同樣的 `.feature`，只跑標 `@e2e` 的場景，步驟在 `tests/e2e/*.steps.ts`（Vitest 不讀）。不選 `@quickpickle/playwright`：作者標示不穩定，且無法開觸控模擬（`pointer: coarse`）。
   - 專案：桌面 Chrome、Android（Pixel 7）、iPhone（WebKit），開啟 `reducedMotion` 讓點擊位置穩定。
   - 資料：`IPAS_E2E=1` 建置時 `#map-data` 指向 `tests/e2e/fixtures/map.json`、`#private-data` 指向空資料夾（本機與 CI 一致，不讀考古題），輸出到 `.output-e2e`。需求背景的主題表格要和假題庫一致，步驟會檢查。
   - 指令：`npm run e2e:build` 再 `npm run e2e`。

第一階段目標是「地圖能操作、網址能打開」，題目數量、Supabase、贊助連結都延後。

## 注意事項

- 這是作者的個人專案，不得引入或參考作者任職公司的任何程式碼、設定或資料。
- 每完成一個可運作的小步驟就 commit 並 push，保持小而頻繁的提交紀錄。
