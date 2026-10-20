# CLAUDE.md

本檔提供 Claude Code 在此 repo 工作時需要的專案脈絡與已確定的決策。功能、架構與 roadmap 的完整說明見 `README.md`。

## 專案概要

- iPAS AI 應用規劃師（初級）的主題地圖與練習網站，個人 side project，兼作求職作品集。
- Repo：`beautifulinda/ipas`，部署網址：`https://beautifulinda.github.io/ipas/`
- 非官方工具，頁面與 README 都必須註明與 iPAS 主辦單位無關。

## 已確定的決策

- 技術：Nuxt 3、Vue 3、TypeScript；地圖用 SVG 與 D3（d3-zoom、d3-hierarchy）；裝置判斷用 VueUse `useMediaQuery`。
- 部署：`nuxt generate` 產生靜態網站，GitHub Actions 部署到 GitHub Pages。
- 子路徑部署：`nuxt.config.ts` 必須設定 `app.baseURL: '/ipas/'`，否則上線後靜態資源路徑錯誤。
- 資料：題庫與地圖結構集中在 `data/` 的 JSON，型別定義在 `types/map.ts`。三層結構為 科目 → 大知識分類 → 主題概念（`questions` 可為空陣列）。
- 裝置分流：
  - 桌面：整張地圖縮放與拖曳、右側面板、鍵盤操作（Esc 返回、方向鍵切換同層）。
  - 手機：一次一層的鑽取式瀏覽、返回按鈕與右滑手勢、bottom sheet、全螢幕作答、觸控目標至少 44px。
  - 判斷同時參考寬度與 `pointer: coarse`，並提供清單模式。
- 隱私：本機優先（local-first）。錯題本、作答紀錄、學習進度只存在使用者瀏覽器（IndexedDB），提供 JSON 匯出、匯入。不做登入，不收集個人資料。
- Supabase（Phase 2）只存匿名答題統計（題目 ID 與對錯）與題目回報。前端只用 anon key；匿名資料表 RLS 設為只能新增、不能讀取原始資料，統計透過彙總 view 或資料庫函式取得，並加寫入頻率限制。
- 前端不得直接呼叫 LLM，也不得出現任何 API key 或 Supabase service_role key。

## 題目與內容規則

- 不轉載官方樣題、考題全文或他人撰寫的解析；官方內容只放連結。
- 題目為自行撰寫，可用 LLM 產生草稿，人工審核後才把 `reviewed` 設為 `true`。CI 必須擋下 `reviewed: false` 的題目。
- 每題標註 `source.type`（`original` 或 `official-link`）。
- 科目與分類名稱依官方最新評鑑範圍，範例資料中標 `TODO` 的部分待作者確認，不要自行補上猜測內容。
- 介面文字、README、註解一律使用正體中文。

## 目前進度與下一步（Phase 1）

1. 建立 Nuxt 3 專案，設定 baseURL 與 GitHub Actions 部署流程。
2. 讀取 `data/map.sample.json`，完成桌面版地圖的點擊縮放與麵包屑。
3. 完成手機版逐層鑽取與 bottom sheet。
4. 概念卡片與練習題作答、作答紀錄存 IndexedDB、匯出匯入。
5. CI：JSON 格式與 `reviewed` 檢查、Vitest 單元測試、Playwright 手機與桌面尺寸測試。

第一階段目標是「地圖能操作、網址能打開」，題目數量、Supabase、贊助連結都延後。

## 注意事項

- 這是作者的個人專案，不得引入或參考作者任職公司的任何程式碼、設定或資料。
- 每完成一個可運作的小步驟就 commit 並 push，保持小而頻繁的提交紀錄。
