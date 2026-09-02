// tsc emits .js; Electron needs .cjs for CommonJS when package.json is type: module.
import { readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
const dir = join(import.meta.dirname, '..', 'dist');
for (const f of readdirSync(dir)) if (f.endsWith('.js')) renameSync(join(dir, f), join(dir, f.replace(/\.js$/, '.cjs')));
