import { build } from 'esbuild';
import { glob } from 'glob';

const entryPoints = glob.sync('src/**/*.ts');

if (entryPoints.length === 0) {
  console.error(`Error: No .js files found in the 'src' directory.`);
  process.exit(1);
}

build({
  entryPoints: entryPoints,
  bundle: true,
  outdir: 'dist',
  target: 'es2020',
  format: 'iife',
  platform: 'browser',
}).catch(() => process.exit(1));