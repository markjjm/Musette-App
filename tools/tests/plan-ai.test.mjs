/* Part of the repo's proof that its controls exist. Run with `npm test`. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(join(ROOT, 'web/site/welcome.html'), 'utf8');

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. Welcome flow contains AI review and modification UI');
ok(html.includes('coachPrompt') || html.includes('aiModInput') || html.includes('askCoachModify'),
  'welcome.html includes interactive AI modification prompt');
ok(html.includes('reviewBox') || html.includes('coachReviewBox') || html.includes('coach-review-box'),
  'welcome.html includes Coach Watts strategic review container');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
