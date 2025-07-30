import { build } from 'esbuild';

build({
    entryPoints: ['src/adapter/main.ts'],
    bundle: true,
    outfile: 'dist/octopus-scheduler-api.js',
    target: 'es2020',
    format: 'iife',
    platform: 'browser',
    banner: {
        js: `
let _doGet, _callOctopusSchedulerApi;
            `
    },
    footer: {
        js: `
function doGet(e){
    return _doGet(e);
}

function callOctopusSchedulerApi(...args){
    return _callOctopusSchedulerApi.apply(this, args);
}
            `
    }
}).catch(() => process.exit(1));