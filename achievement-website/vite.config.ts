import { copyFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { defineConfig, type Plugin, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Features } from 'lightningcss'
import { z } from 'zod'
import { catalogPng } from './build/catalog-png.ts'

const exclusiveGroupsSchema = z.array(z.array(z.number().int().positive()).min(2))

function validatedExclusiveGroups(achievementIds: ReadonlySet<number>, groups: unknown) {
  const result = exclusiveGroupsSchema.safeParse(groups)
  if (!result.success)
    throw new Error('Invalid achievement-exclusive-groups.json', { cause: result.error })

  const seen = new Set<number>()
  for (const group of result.data)
    for (const id of group) {
      if (!achievementIds.has(id)) throw new Error(`Unknown exclusive achievement ID ${id}`)
      if (seen.has(id)) throw new Error(`Duplicate exclusive achievement ID ${id}`)
      seen.add(id)
    }
  return result.data
}

function catalogPreview(path: string, png: Buffer): Plugin {
  return {
    name: 'public-achievement-catalog',
    configureServer(server) {
      server.middlewares.use('/' + path, (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405).end()
          return
        }
        response
          .writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' })
          .end(png)
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

function externalAssetUrl(filename: string, imageLinks: Partial<Record<string, string>>) {
  if (/^assets\/H7GBK-Heavy-[\w-]{8}\.ttf$/.test(filename))
    return 'https://media-cdn-mingchao.kurogame.com/font/H7GBK-Heavy.ttf'
  const name = filename.match(/^assets\/(.+)-[\w-]{8}\.png$/)?.[1]
  return name ? imageLinks[name + '.png'] : undefined
}

function removeExternalAssets(assetUrl: (filename: string) => string | undefined): Plugin {
  return {
    name: 'remove-external-website-assets',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const fileName of Object.keys(bundle)) {
          if (assetUrl(fileName)) delete bundle[fileName]
        }
      },
    },
  }
}

async function configureViewerCatalog(websiteBuild: boolean) {
  const [{ buildPublicPreview, readCatalog }, { default: groups }, { exclusionReason }] =
    await Promise.all([
      import('./build/public-catalog.ts'),
      import('../data/achievement-exclusive-groups.json', { with: { type: 'json' } }),
      import('./src/lib/exclusions.ts'),
    ])
  const websiteCatalog = websiteBuild
    ? (await import('./website-catalog.json', { with: { type: 'json' } })).default
    : undefined
  const catalog = await readCatalog()
  const exclusiveGroups = validatedExclusiveGroups(
    new Set(catalog.achievements.map(({ id }) => id)),
    groups,
  )
  const data = buildPublicPreview(catalog)
  const catalogExclusions = data.achievements.flatMap((item) => {
    const reason = item.inMainMenu ? exclusionReason(item) : null
    return reason ? [{ id: item.id, texts: item.texts, reason }] : []
  })
  const preview = JSON.stringify(data)
  const png = websiteBuild ? undefined : catalogPng(preview)
  const version = createHash('sha256')
    .update(png ?? preview)
    .digest('hex')
  if (websiteCatalog && version !== websiteCatalog.sourceSha256)
    throw new Error('Run mise exec -- pnpm upload:catalog to update website-catalog.json')
  const catalogPath = 'data/achievement-catalog.png'
  return {
    define: {
      'import.meta.env.VITE_EXCLUSIVE_ACHIEVEMENT_GROUPS': JSON.stringify(exclusiveGroups),
      'import.meta.env.VITE_CATALOG_EXCLUSIONS': JSON.stringify(catalogExclusions),
      'import.meta.env.VITE_CATALOG_VERSION': JSON.stringify(version),
      'import.meta.env.VITE_CATALOG_URL': JSON.stringify(websiteCatalog?.url ?? '/' + catalogPath),
    },
    plugin: png && catalogPreview(catalogPath, png),
  }
}

export default defineConfig(async ({ command }): Promise<UserConfig> => {
  const desktopBuild = process.env.WUWA_BUILD_TARGET === 'desktop'
  const websiteBuild = command === 'build' && !desktopBuild
  const catalog = desktopBuild ? undefined : await configureViewerCatalog(websiteBuild)
  const imageLinks = websiteBuild
    ? (await import('./website-images.json', { with: { type: 'json' } })).default
    : undefined
  const assetUrl = imageLinks && ((filename: string) => externalAssetUrl(filename, imageLinks))
  return {
    define: {
      ...catalog?.define,
      'import.meta.env.VITE_DESKTOP_BUILD': JSON.stringify(desktopBuild),
    },
    publicDir: desktopBuild ? false : undefined,
    experimental: assetUrl ? { renderBuiltUrl: assetUrl } : undefined,
    plugins: [
      react(),
      tailwindcss(),
      catalog?.plugin,
      copyRoutePages(),
      assetUrl && removeExternalAssets(assetUrl),
    ],
    // The polyfill cannot see the color-scheme set by the app at runtime.
    css: { lightningcss: { exclude: Features.LightDark } },
    build: {
      modulePreload: false,
      rolldownOptions: { output: { assetFileNames: 'assets/[name]-[hash:8][extname]' } },
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  }
})
