import { build } from 'esbuild';

build({
    entryPoints: ['src/adapter/main.ts'],
    bundle: true,
    outfile: 'dist/content-dock-api.js',
    target: 'es2020',
    format: 'iife',
    platform: 'browser',
    banner: {
        js: `
let _callContentDockApi;
            `
    },
    footer: {
        js: `
function callContentDockApi(...args){
    return _callContentDockApi.apply(this, args);
}
            `
    }
}).catch(() => process.exit(1));