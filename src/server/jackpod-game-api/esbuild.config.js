import { build } from 'esbuild';

build({
    entryPoints: ['src/api.ts'],
    bundle: true,
    outfile: 'dist/jacpod-game-api.js',
    target: 'es2020',
    format: 'iife', // 全体をIIFEとしてバンドル
    platform: 'browser', // GASの実行環境を想定
    banner: {
        js: `
let _callJackpodGameApi;
            `
    },
    footer: {
        js: `
function callJackpodGameApi(...args){
    return _callJackpodGameApi.apply(this, args);
}
            `
    }
}).catch(() => process.exit(1));