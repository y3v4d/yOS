import { defineConfig } from 'vite'
import { buildAppsPlugin } from './tools/vite-plugin-apps'
import { buildLibsPlugin } from './tools/vite-plugin-libs'

// https://vite.dev/config/
export default defineConfig({
  build: {
    assetsInlineLimit: 0
  },
  plugins: [
    buildLibsPlugin({
      appsDir: 'libs',
      autoBuild: true,
      watch: true,
      keyBy: 'folder',
    }),
    buildAppsPlugin({
      appsDir: 'apps',
      autoBuild: true,
      watch: true,
      keyBy: 'folder',
    })
  ],
})
