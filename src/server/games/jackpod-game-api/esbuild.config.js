import { build } from 'esbuild';

build({
    entryPoints: ['src/infrastructure/external/main.ts'],
    bundle: true,
    outfile: 'dist/jackpod-game-api.js',
    target: 'es2020',
    format: 'iife',
    platform: 'browser',
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