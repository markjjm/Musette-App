/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Every inline script the site serves must actually PARSE.

   This exists because it did not. Commit d549ded replaced the line

       }  const tb = e.target.closest('#tabs button[data-t]');

   with its own handler and dropped the leading brace, leaving `if (fdz) {`
   open. One missing character, and the app's entire 400 KB script - sync,
   render, auth, the lot - failed to compile. Nothing ran. The page served its
   static shell and nothing else, so the app looked like an empty local copy
   with no account behind it, and it shipped that way for four days across
   several deploys.

   Nothing caught it. The CSP gate hashes the script without reading it, scan.mjs
   greps for patterns, and the other suites import worker.js or lift individual
   functions out of the page - none of them ever compiled the whole thing. A
   syntax error is the one defect that breaks EVERY feature at once, so it is
   worth one cheap check. vm.Script compiles without executing, which is exactly
   the question being asked and nothing more. */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Script } from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

/* Inline blocks only. A src= script is somebody else's file. */
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const start = m.index + m[0].length;
    /* The close tag cannot appear inside JS source - the HTML parser would end
       the element there too - so the next one is always the right one. */
    const end = html.indexOf('</script>', start);
    if (end < 0) { out.push({ start, src: null }); break; }
    out.push({ start, src: html.slice(start, end) });
    re.lastIndex = end;
  }
  return out;
}

const pages = [];
for (const dir of ['web/public', 'web/site']) {
  for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.html'))) {
    pages.push(join(dir, f));
  }
}
pages.sort();

console.log(`\n1. Every inline script in ${pages.length} served pages compiles`);
for (const rel of pages) {
  const html = readFileSync(join(ROOT, rel), 'utf8');
  const blocks = inlineScripts(html);
  let bad = null, n = 0;
  for (const b of blocks) {
    if (b.src === null) { bad = 'unclosed <script> tag'; break; }
    if (!b.src.trim()) continue;
    n++;
    try {
      new Script(b.src, { filename: rel });
    } catch (e) {
      /* The line number is relative to the block; make it useful. */
      const line = html.slice(0, b.start).split('\n').length;
      bad = `${e.message} (block starting at ${rel} line ${line})`;
      break;
    }
  }
  ok(!bad, bad ? `${rel} - ${bad}` : `${rel} (${n} block${n === 1 ? '' : 's'})`);
}

console.log('\n2. Every $(\'id\') the page wires up actually exists in its markup');
/* Only pages whose $ is getElementById - the app's $ takes a CSS selector.
   Removing an element while leaving its handler behind is a null dereference at
   load, which kills the whole script exactly as a syntax error does: dropping
   the Publish button from the profile card left $('pub').addEventListener
   pointing at nothing, and that would have taken the page down with it. */
for (const rel of pages) {
  const html = readFileSync(join(ROOT, rel), 'utf8');
  if (!/\$\s*=\s*function\s*\(\s*id\s*\)\s*\{\s*return document\.getElementById/.test(html)) continue;
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
  const refs = [...new Set([...html.matchAll(/\$\(\s*'([A-Za-z][\w-]*)'\s*\)/g)].map((m) => m[1]))];
  const missing = refs.filter((r) => !ids.has(r));
  ok(missing.length === 0,
    missing.length ? `${rel} wires up ${missing.join(', ')} - no such element` : `${rel} (${refs.length} ids, all present)`);
}

console.log('\n3. The defect this was written for stays fixed');
const app = readFileSync(join(ROOT, 'web/public/index.html'), 'utf8');
/* The exact shape of it: a bare `return;` followed by the next handler with no
   brace between them. */
ok(!/if \(inp\) inp\.click\(\);\s*\n\s*return;\s*\n\s*const garminBtn/.test(app),
  'the #fit_drop_zone branch is closed before the next handler begins');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
