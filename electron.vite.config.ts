import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: fileURLToPath(new URL('./src/main/index.ts', import.meta.url))
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: fileURLToPath(new URL('./src/preload/index.ts', import.meta.url))
      }
    }
  },
  renderer: {
    root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
    resolve: {
      alias: {
        '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
        '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: fileURLToPath(new URL('./src/renderer/index.html', import.meta.url))
      }
    },
    server: {
      fs: {
        allow: [root]
      }
    }
  }
})
