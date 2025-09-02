import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
export default defineConfig({
    plugins: [
        vue(),
        viteSingleFile(),
    ],
    build: {
        target: "es2020",
        outDir: 'dist',
    },
    resolve: {
        alias: {
            '@common-lib': path.resolve(__dirname, '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src'),
        },
    }
});
