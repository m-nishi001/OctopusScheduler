import { build } from 'esbuild';
import { glob } from 'glob';

// 'src' ディレクトリ以下のすべての '.js' ファイルを取得
const entryPoints = glob.sync('src/**/*.ts');

// entryPointsが空の場合の処理を追加
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