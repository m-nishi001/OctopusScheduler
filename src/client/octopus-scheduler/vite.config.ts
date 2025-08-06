import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    viteSingleFile(),
  ],
  build: {
    target: "es2020",
  },
  resolve: {
    alias: {
      '@content-deck': path.resolve(__dirname, '/root/google_apps_script/octopus-scheduler/src/client/presenters/content-deck/src'),
      '@common-lib': path.resolve(__dirname,'/root/google_apps_script/octopus-scheduler/src/client/commonLib/src')
    },
  }
})
