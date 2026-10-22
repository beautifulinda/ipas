import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config

// 部署在 GitHub Pages 子路徑 /ipas/，少了這個設定上線後靜態資源路徑會錯
const baseURL = '/ipas/'

// E2E 測試：IPAS_E2E=1 時改用 tests/e2e/fixtures/ 的假題庫、不讀私人題庫（CI 讀不到，本機也要一致），
// 輸出到 .output-e2e，不影響正式網站
const e2e = process.env.IPAS_E2E === '1'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-20',
  devtools: { enabled: true },
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      title: 'iPAS AI 應用規劃師（初級）主題地圖',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '個人製作的 iPAS AI 應用規劃師初級練習工具，與 iPAS 主辦單位無關。' },
      ],
      // head 裡的連結不會自動加上 baseURL
      link: [{ rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` }],
    },
  },
  ssr: true,
  alias: {
    '#map-data': fileURLToPath(new URL(e2e ? './tests/e2e/fixtures/map.json' : './data/map.json', import.meta.url)),
    '#private-data': fileURLToPath(new URL(e2e ? './tests/e2e/fixtures/no-private' : './data/private', import.meta.url)),
  },
  ...(e2e && { nitro: { output: { dir: '.output-e2e' } } }),
})
