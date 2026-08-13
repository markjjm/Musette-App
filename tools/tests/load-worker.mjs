/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Load the real worker.js in plain node: stub the cloudflare:workers import and
   re-export the internals we want to test. No paraphrasing — the code under test
   is byte-for-byte what deploys. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const WORKER = join(ROOT, 'worker/worker.js');

export async function loadWorker(names) {
  let src = readFileSync(WORKER, 'utf8');
  src = src.replace(
    /^import\s+\{[^}]*\}\s+from\s+'cloudflare:workers';?$/m,
    'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }'
  );
  /* Anything worker.js already exports — `ListDO`, the default handler — must not
     be re-exported here, or the module fails to compile on a duplicate export. */
  const already = new Set(
    [...src.matchAll(/^export\s+(?:async\s+)?(?:class|function|const|let|var)\s+(\w+)/gm)].map((m) => m[1])
  );
  const add = names.filter((n) => !already.has(n));
  const missing = names.filter((n) => !already.has(n) && !new RegExp(`\\b(?:class|function|const|let|var)\\s+${n}\\b`).test(src));
  if (missing.length) {
    throw new Error(`worker.js has no top-level ${missing.join(', ')} - the test is asking for something that no longer exists`);
  }
  if (add.length) src += `\nexport { ${add.join(', ')} };\n`;
  const tmp = join(mkdtempSync(join(tmpdir(), 'worker-ut-')), 'worker-under-test.mjs');
  writeFileSync(tmp, src);
  return await import(tmp + '?v=' + src.length);
}
