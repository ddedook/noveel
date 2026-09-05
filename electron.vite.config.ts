import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const aliases = {
  '@': resolve(__dirname),
  '@/app': resolve(__dirname, 'app'),
  '@/lib': resolve(__dirname, 'lib'),
  '@/resources': resolve(__dirname, 'resources'),
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { main: resolve(__dirname, 'lib/main/main.ts') },
        external: [/^@deepseek-ai\//, /^@noveel\//],
      },
    },
    resolve: { alias: aliases },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { preload: resolve(__dirname, 'lib/preload/preload.ts') },
      },
    },
    resolve: { alias: aliases },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: './app',
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'app/index.html') },
      },
    },
    resolve: { alias: aliases },
    plugins: [tailwindcss(), react()],
  },
})
