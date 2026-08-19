import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/icons', { recursive: true });
cpSync('manifest.json', 'dist/manifest.json');
cpSync('public/icons', 'dist/icons', { recursive: true });
console.log('assets copied');
