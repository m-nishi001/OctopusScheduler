import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

// 指定したディレクトリから再帰的にファイルを検索する関数
function findFilesRecursively(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFilesRecursively(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

const entryDir = 'src';

// 指定したディレクトリからすべての .ts ファイルを再帰的に取得
const entryPoints = findFilesRecursively(entryDir)
  .filter(file => file.endsWith('.ts'));

// entryPoints が空の場合の処理
if (entryPoints.length === 0) {
  console.error(`Error: No .ts files found in the '${entryDir}' directory.`);
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