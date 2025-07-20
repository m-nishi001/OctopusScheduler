import { build } from 'esbuild';

build({
    entryPoints: ['src/api.ts'],
    bundle: true,
    outfile: 'dist/card-game-api.js',
    target: 'es2020',
    format: 'iife', // 全体をIIFEとしてバンドル
    platform: 'browser', // GASの実行環境を想定
    banner: {
        js: `
let _callCardGameApi;
            `
    },
    footer: {
        js: `
function callCardGameApi(...args){
    return _callCardGameApi.apply(this, args);
}
            `
    }
}).catch(() => process.exit(1));