# CLAUDE.md

本檔提供 Claude Code 在此 repo 工作時需要的專案脈絡與已確定的決策。功能、架構與 roadmap 的完整說明見 `README.md`。

## 專案概要

- iPAS AI 應用規劃師（初級）的主題地圖與練習網站，個人 side project，兼作求職作品集。
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
  - 「掌握」的定義：該概念所有題目的最近一次作答都答對。沒有題目的概念視為未完成（題庫補齊前，該地區不會插旗、島不會亮燈）。
  - 面積目前依概念數量分配；是否改依考古題比重尚未決定。
  - 不支援 WebGL 時自動改用清單模式；系統開啟減少動態效果時關閉海浪、煙火與鏡頭飛行。
  - 其他嘗試過的版本保留在分支：`pixel-style`（像素風 SVG）、`island-natural-style`、`treemap-layout`、`circle-pack-layout`。
  - web3：2026-10-20 作者詢問，評估後目前不納入規劃（與隱私原則衝突、對備考沒有幫助）；作者尚未做最終決定。
- 裝置分流：
  - 桌面：整張地圖縮放與拖曳、右側面板、鍵盤操作（Esc 返回、方向鍵切換同層）。
  - 手機：同一張島嶼地圖，點擊逐層放大（一次聚焦一層）、返回按鈕與右滑手勢、bottom sheet、全螢幕作答、觸控目標至少 44px。直式螢幕時島改為上下排列。
  - 判斷同時參考寬度與 `pointer: coarse`，並提供清單模式。
- 隱私：本機優先（local-first）。錯題本、作答紀錄、學習進度只存在使用者瀏覽器（IndexedDB），提供 JSON 匯出、匯入。不做登入，不收集個人資料。
- Supabase（Phase 2）只存匿名答題統計（題目 ID 與對錯）與題目回報。前端只用 anon key；匿名資料表 RLS 設為只能新增、不能讀取原始資料，統計透過彙總 view 或資料庫函式取得，並加寫入頻率限制。
- 前端不得直接呼叫 LLM，也不得出現任何 API key 或 Supabase service_role key。

## 題目與內容規則

- 不轉載官方樣題、考題全文或他人撰寫的解析到 repo 或公開網站；官方內容只放連結。
- 例外（作者 2026-10-20 決定，網站尚未發佈）：官方公告試題可供作者本機練習，但只能放在 `data/private/`（已列入 `.gitignore`），不可 commit、不可放進 `data/map.json` 或草稿、不可公開部署。
  - 匯入：`node scripts/import-past-papers.mjs ~/Vault/Sources/PDF data/private/past-papers.concepts.json`，輸出 `data/private/past-papers.json`；概念對照檔由 Claude 逐題判斷，可再調整。
  - 網站在檔案存在時才載入（`import.meta.glob`），GitHub Actions 部署時沒有這個檔案，公開版不含考古題。不要用本機 `npm run generate` 的產出手動部署。
  - `npm run validate` 會擋下出現在 git 追蹤檔案中的考古題（ID 以 `past-` 開頭）。
  - 「不公開官方試題」是作者自訂的保守規則，不是官方明文禁止：著作權法第 9 條排除「依法令舉行之各類考試試題」，但查無函釋認定 iPAS 屬於此類。作者 2026-10-20 已寫信詢問 iPAS（`ipas@itri.org.tw`），收到回覆前維持現行規則；他人撰寫的解析一律不轉載。
- 題目為自行撰寫，可用 LLM 產生草稿，人工審核後才把 `reviewed` 設為 `true`。CI 必須擋下 `reviewed: false` 的題目。
- 每題標註 `source.type`（`original` 或 `official-link`）。
- 科目、分類、概念依官方〈AI 應用規劃師能力鑑定 評鑑內容範圍參考〉115.02 更新版（作者 2026-10-20 確認採用）：分類＝評鑑主題（如 L113），概念＝評鑑內容（如 L11302），ID 直接用官方代碼，來源記在 `data/map.json` 的 `scopeSource`。官方改版時以新版為準，不要自行補上猜測內容。
- 題目流程：草稿放 `data/drafts/questions.draft.json`（網站不讀取，`reviewed: false`）→ 作者用 `npm run review` 逐題作答並審核 → 通過的題目移到 `data/map.json` 並設為 `reviewed: true`。`npm run validate` 會擋下正式題庫中未審核的題目。
- 概念說明（summary、keyPoints）由 Claude 依官方範圍撰寫，作者可直接修改。
- 介面文字、README、註解一律使用正體中文。

## 目前進度與下一步（Phase 1）

1. ✅ 建立 Nuxt 3 專案，設定 baseURL 與 GitHub Actions 部署流程。尚未建立遠端 repo、尚未 push。
2. ✅ 讀取 `data/map.json`，完成桌面版地圖（島嶼地圖）的點擊縮放、麵包屑與鍵盤操作。
3. ✅ 手機版：返回按鈕、bottom sheet（可拖曳展開／收起／關閉）、全螢幕作答、觸控目標 44px、清單模式。
   - 右滑手勢靠瀏覽器歷史紀錄實現：地圖位置同步到網址 `?at=節點ID`（`composables/useFocusHistory.ts`），iPhone 左緣右滑、Android 返回鍵都會回上一層。
   - 必須透過 vue-router（頁面在 `pages/index.vue`），不可直接呼叫 `history.pushState`：Nuxt 的簡易路由在有 baseURL 時處理上一頁會把網址疊成 `/ipas/ipas/`。
   - 裝置判斷在掛載後才生效（`composables/useDevice.ts`），避免靜態 HTML 與 hydration 不一致。
4. ✅ 概念卡片與練習題作答、作答紀錄存 IndexedDB（`composables/useRecords.ts`）、錯題本、匯出匯入（格式與合併邏輯在 `utils/progress.ts`）。
5. CI：JSON 格式與 `reviewed` 檢查、Vitest 單元測試、Playwright 手機與桌面尺寸測試。

第一階段目標是「地圖能操作、網址能打開」，題目數量、Supabase、贊助連結都延後。

## 注意事項

- 這是作者的個人專案，不得引入或參考作者任職公司的任何程式碼、設定或資料。
- 每完成一個可運作的小步驟就 commit 並 push，保持小而頻繁的提交紀錄。
