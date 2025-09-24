import { build } from 'esbuild';

build({
    entryPoints: ['src/infrastructure/external/main.ts'],
    bundle: true,
    outfile: 'dist/jackpot-game-api.js',
    target: 'es2020',
    format: 'iife',
    platform: 'browser',
    banner: {
        js: `
let _calljackpotGameApi;
            `
    },
    footer: {
        js: `
function callJackpotGameApi(...args){
    return _calljackpotGameApi.apply(this, args);
}
            `
    }
}).catch(() => process.exit(1));