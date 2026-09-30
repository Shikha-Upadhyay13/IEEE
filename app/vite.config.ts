import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildRobots, buildSitemap, normalizeSiteUrl } from './src/lib/seo/publicRoutes.ts'

// Emits robots.txt and sitemap.xml for the configured public URL and fills
// the absolute og:image/og:url values that link-preview crawlers require.
function seoFiles(siteUrl: string): Plugin {
  const files: Record<string, () => { type: string; body: string }> = {
    '/robots.txt': () => ({ type: 'text/plain', body: buildRobots(siteUrl) }),
    '/sitemap.xml': () => ({
      type: 'application/xml',
      body: buildSitemap(siteUrl, undefined, new Date().toISOString().slice(0, 10)),
    }),
  }
  return {
    name: 'seo-files',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url ? files[req.url] : undefined
        if (!file) return next()
        const { type, body } = file()
        res.setHeader('Content-Type', type)
        res.end(body)
      })
    },
    generateBundle() {
      for (const [path, file] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source: file().body })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL || 'http://localhost:5173')
  return {
    plugins: [react(), tailwindcss(), seoFiles(siteUrl)],
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
