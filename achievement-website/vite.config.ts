import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Features } from 'lightningcss'
import { parseExport } from './src/lib/data.ts'

type Texts = Record<string, { title: string | null; description?: string | null }>
interface Item {
  id: number
  groupId: number
  categoryId: number
  inMainMenu: boolean
  hidden: boolean
  nextLink: number
  titleKey: string
  descriptionKey: string
  level: number
  astrite: number
  rewards: { itemId: number; quantity: number }[]
  texts: Texts
}
interface Catalog {
  collectedAt: string
  languages: string[]
  languageCoverage: unknown[]
  categories: { id: number; inMainMenu: boolean; texts: Texts }[]
  groups: { id: number; categoryId: number; sort: number; enabled: boolean; texts: Texts }[]
  achievements: Item[]
}
async function publicPreview() {
  const c: Catalog = JSON.parse(
    await readFile(new URL('../data/achievement-catalog.json', import.meta.url), 'utf8'),
  )
  const achievements = c.achievements.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    categoryId: a.categoryId,
    inMainMenu: a.inMainMenu,
    hidden: a.hidden,
    titleKey: a.titleKey,
    descriptionKey: a.descriptionKey,
    level: a.level,
    astrite: a.astrite,
    rewards: a.rewards,
    texts: a.texts,
    previousId: c.achievements.find((p) => p.nextLink === a.id)?.id ?? -1,
    nextId: a.nextLink,
    visibleForAccount: false,
    visibilityReason: 'catalog-preview',
    clientState: 'unknown',
    currentProgress: null,
    maxProgress: null,
    hasGetReward: null,
    finishTimeRaw: null,
    status: 'unknown',
    progressSource: 'catalog-only',
  }))
  return JSON.stringify(
    parseExport({
      schemaVersion: 2,
      complete: true,
      preview: true,
      capturedAt: c.collectedAt,
      count: achievements.length,
      completedCount: 0,
      starCount: 0,
      mainMenuCount: achievements.filter((a) => a.inMainMenu).length,
      otherGameplayCount: achievements.filter((a) => !a.inMainMenu).length,
      languages: c.languages,
      languageCoverage: c.languageCoverage,
      categories: c.categories
        .filter((c) => c.inMainMenu)
        .map((category) => ({
          id: category.id,
          texts: category.texts,
          groups: c.groups
            .filter((g) => g.categoryId === category.id)
            .map((g) => ({
              id: g.id,
              categoryId: g.categoryId,
              sort: g.sort,
              enabled: g.enabled,
              texts: g.texts,
              unlocked: false,
              achievementIds: achievements.filter((a) => a.groupId === g.id).map((a) => a.id),
            })),
        })),
      achievements,
    }),
  )
}
function catalogPreview(preview: string): Plugin {
  return {
    name: 'public-achievement-catalog',
    configureServer(server) {
      server.middlewares.use('/data/achievements.json', async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405).end()
          return
        }
        response
          .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          .end(preview)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'data/achievements.json',
        source: preview,
      })
    },
  }
}
function copyRoutePages(): Plugin {
  return {
    name: 'copy-route-pages',
    apply: 'build',
    async writeBundle({ dir }) {
      if (!dir) return
      const entry = resolve(dir, 'index.html')
      const desktopDir = resolve(dir, 'desktop')
      await mkdir(desktopDir, { recursive: true })
      await Promise.all([
        copyFile(entry, resolve(desktopDir, 'index.html')),
        copyFile(entry, resolve(dir, '404.html')),
      ])
    },
  }
}

export default defineConfig(async ({ command }) => {
  const preview = await publicPreview()
  const version = createHash('sha256').update(preview).digest('hex')
  const cdnBase = command === 'build' ? process.env.CDN_BASE : undefined
  return {
    base: '/',
    experimental: cdnBase
      ? { renderBuiltUrl: (filename: string) => cdnBase + filename }
      : undefined,
    define: { 'import.meta.env.VITE_PREVIEW_VERSION': JSON.stringify(version) },
    plugins: [react(), tailwindcss(), catalogPreview(preview), copyRoutePages()],
    // The polyfill cannot see the color-scheme set by the app at runtime.
    css: { lightningcss: { exclude: Features.LightDark } },
    build: { modulePreload: false },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  }
})
