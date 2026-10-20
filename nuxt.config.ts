// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-20',
  devtools: { enabled: true },
  // 部署在 GitHub Pages 子路徑 /ipas/，少了這行上線後靜態資源路徑會錯
  app: {
    baseURL: '/ipas/',
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      title: 'iPAS AI 應用規劃師（初級）主題地圖',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '個人製作的 iPAS AI 應用規劃師初級練習工具，與 iPAS 主辦單位無關。' },
      ],
    },
  },
  ssr: true,
})
