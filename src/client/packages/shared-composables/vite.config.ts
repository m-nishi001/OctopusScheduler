import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2020",
  },
  resolve: {
    alias: {
      '@common-lib': path.resolve(__dirname, '/root/google_apps_script/octopus-scheduler/src/client/common-lib/src'),
      '@shared-composables': path.resolve(__dirname, '/root/google_apps_script/octopus-scheduler/src/client/package/shared-composables')
    },
  }
})
