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
let _doGet, _callCustomFunction;
            `
    },
    footer: {
        js: `
function doGet(e){
    return _doGet(e);
}

function callCustomFunction(...args){
    return _callCustomFunction.apply(this, args);
}
            `
    }
}).catch(() => process.exit(1));