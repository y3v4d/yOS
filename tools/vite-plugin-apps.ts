import { type Plugin, type ResolvedConfig, type ViteDevServer, build } from 'vite'
import { readdirSync, readFileSync, existsSync, statSync, watch, mkdirSync, copyFileSync } from 'fs'
import { join, resolve } from 'path'

const VIRTUAL_MODULE_ID = 'virtual:apps'
const RESOLVED_ID = '\0virtual:apps'

export interface AppsPluginOptions {
  /** Path to the apps directory. Default: 'apps' */
  appsDir?: string
  /** If true, plugin will call vite build() for each app automatically. Default: true */
  autoBuild?: boolean
  /** If true in dev mode, watches app src files and rebuilds on change. Default: true */
  watch?: boolean
  /** Key apps by: 'folder' | 'packageName'. Default: 'folder' */
  keyBy?: 'folder' | 'packageName'
  /** Base URL path for app scripts in production. Default: '/apps' */
  prodBasePath?: string
}

function getAppDirs(appsDir: string): string[] {
  return readdirSync(appsDir).filter(name => {
    const full = join(appsDir, name)
    return statSync(full).isDirectory()
  })
}

function getAppKey(appDir: string, appName: string, keyBy: 'folder' | 'packageName'): string {
  if (keyBy === 'packageName') {
    const pkgPath = join(appDir, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.name) return pkg.name
    }
  }
  return appName
}

function findBuiltFile(rootDir: string, appName: string): string | null {
  const distDir = join(rootDir, 'dist', 'apps')
  if (!existsSync(distDir)) return null
  const candidate = join(distDir, `${appName}.js`)
  if (existsSync(candidate)) return candidate
  // fallback: find any .js file prefixed with appName
  const files = readdirSync(distDir).filter(f => f.startsWith(appName) && f.endsWith('.js'))
  if (files.length === 0) return null
  return join(distDir, files[0])
}

async function buildApp(appDir: string, configFile: string): Promise<void> {
  await build({
    configFile,
    logLevel: 'warn',
  })
}

export function buildAppsPlugin(options: AppsPluginOptions = {}): Plugin {
  const {
    appsDir = 'apps',
    autoBuild = true,
    watch: watchMode = true,
    keyBy = 'folder',
    prodBasePath = '/apps',
  } = options

  let rootDir: string
  let resolvedAppsDir: string
  let config: ResolvedConfig
  let viteServer: ViteDevServer | undefined
  // dev: Map<key, source string>  |  prod: Map<key, url string>
  const appCache = new Map<string, string>()

  async function loadAllApps(isDev: boolean) {
    const appNames = getAppDirs(resolvedAppsDir)

    for (const appName of appNames) {
      const appDir = join(resolvedAppsDir, appName)
      const configCandidates = [
        join(appDir, 'vite.config.ts'),
        join(appDir, 'vite.config.js'),
      ]
      const configFile = configCandidates.find(existsSync)

      if (autoBuild && configFile) {
        const builtFile = findBuiltFile(rootDir, appName)
        if (!builtFile || isDev) {
          console.log(`[vite-plugin-apps] Building ${appName}...`)
          await buildApp(appDir, configFile)
        }
      }

      const key = getAppKey(appDir, appName, keyBy)

      if (isDev) {
        const builtFile = findBuiltFile(rootDir, appName)
        if (!builtFile) {
          console.warn(`[vite-plugin-apps] No built file found for app "${appName}"`)
          continue
        }
        const source = readFileSync(builtFile, 'utf-8')
        appCache.set(key, source)
        console.log(`[vite-plugin-apps] Loaded app "${key}" (${(source.length / 1024).toFixed(1)}kb)`)
      } else {
        // prod: store the URL — file will be copied to dist/apps/ in closeBundle
        const url = `${prodBasePath}/${appName}.js`
        appCache.set(key, url)
        console.log(`[vite-plugin-apps] Registered app "${key}" -> ${url}`)
      }
    }
  }

  function generateVirtualModule(isDev: boolean): string {
    const entries = [...appCache.entries()]
      .map(([key, val]) => `  ${JSON.stringify(key)}: ${JSON.stringify(val)}`)
      .join(',\n')

    if (isDev) {
      return [
        `export const apps = {\n${entries}\n};`,
        `export const appUrls = undefined;`,
        `export default apps;`,
      ].join('\n')
    } else {
      return [
        `export const apps = undefined;`,
        `export const appUrls = {\n${entries}\n};`,
        `export default appUrls;`,
      ].join('\n')
    }
  }

  return {
    name: 'vite-plugin-apps',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig
      rootDir = resolvedConfig.root
      resolvedAppsDir = resolve(rootDir, appsDir)
    },

    configureServer(server) {
      viteServer = server
    },

    async buildStart() {
      const isDev = config.command === 'serve'
      await loadAllApps(isDev)

      if (isDev && watchMode) {
        for (const appName of getAppDirs(resolvedAppsDir)) {
          const appDir = join(resolvedAppsDir, appName)
          const srcDir = join(appDir, 'src')
          const watchTarget = existsSync(srcDir) ? srcDir : appDir

          watch(watchTarget, { recursive: true }, async (event, filename) => {
            if (!filename || filename.startsWith('dist')) return
            if (!filename.match(/\.(ts|js|svelte|css|html)$/)) return

            const configCandidates = [
              join(appDir, 'vite.config.ts'),
              join(appDir, 'vite.config.js'),
            ]
            const configFile = configCandidates.find(existsSync)
            if (!configFile) return

            console.log(`[vite-plugin-apps] "${appName}" changed, rebuilding...`)
            try {
              await buildApp(appDir, configFile)
              const builtFile = findBuiltFile(rootDir, appName)
              if (builtFile) {
                const key = getAppKey(appDir, appName, keyBy)
                appCache.set(key, readFileSync(builtFile, 'utf-8'))
                viteServer?.moduleGraph.invalidateAll()
                viteServer?.hot.send({ type: 'full-reload' })
              }
            } catch (e) {
              console.error(`[vite-plugin-apps] Build failed for "${appName}":`, e)
            }
          })
        }
      }
    },

    async closeBundle() {
        if (config.command === 'serve') return
        for (const appName of getAppDirs(resolvedAppsDir)) {
            const appDir = join(resolvedAppsDir, appName)
            const configCandidates = [
                join(appDir, 'vite.config.ts'),
                join(appDir, 'vite.config.js'),
            ]
            const configFile = configCandidates.find(existsSync)
            if (!configFile) {
                console.warn(`[vite-plugin-apps] No vite config found for "${appName}"`)
                continue
            }
            console.log(`[vite-plugin-apps] Building ${appName} into dist/apps/...`)
            await buildApp(appDir, configFile)
        }
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID
    },

    load(id) {
      if (id === RESOLVED_ID) {
        const isDev = config.command === 'serve'
        return generateVirtualModule(isDev)
      }
    },
  }
}