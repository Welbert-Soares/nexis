import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({
      routeRules: {
        // Vite-hashed bundles — a new deploy always ships new filenames, so these can be cached forever.
        '/assets/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
        // iOS standalone (Add to Home Screen) caches the document response far more
        // aggressively than desktop Safari, which is why updates only showed up after
        // removing and re-adding the app. Force revalidation on every request instead.
        '/**': { headers: { 'cache-control': 'no-cache, no-store, must-revalidate' } },
      },
    }),
    viteReact(),
  ],
})

export default config
