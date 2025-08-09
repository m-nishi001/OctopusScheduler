import { readdirSync } from 'fs';
import { join } from 'path';
import { build as _build } from 'esbuild';

const srcDir = 'src';
const outDir = 'dist';

const findTsFiles = (dir) => {
    let tsFiles = [];
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            tsFiles = tsFiles.concat(findTsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            tsFiles.push(fullPath);
        }
    }

    return tsFiles;
};

const build = async () => {
    const entryPoints = findTsFiles(srcDir);
    console.log('Found TypeScript files:', entryPoints);

    await _build({
        entryPoints,
        outdir: outDir,
        bundle: true,
        target: 'es2020',
        format: 'iife',
        platform: 'browser',
    }).catch(() => process.exit(1));

    console.log('Build completed successfully!');
};

build();