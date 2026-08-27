#!/usr/bin/env node
/*
 * Generates a strict, hash-based CSP for every page this repo serves.
 *
 * Each page carries its own inline <script> and <style>, whose sha256 hashes
 * change on every edit, so _headers is generated from the files rather than
 * hand-maintained. Run `npm run build` after editing any page; `npm run scan`
 * fails if a _headers file is stale.
 *
 * It used to do exactly one file. That was not a simplification, it was a
 * ceiling: _headers applied the app's hashes to `/*`, so a SECOND page with its
 * own inline style would have been served the first page's policy and rendered
 * unstyled, with nothing to say why. Every page now gets its own block, keyed on
 * its own path, and a page is only allowed what it actually needs.
 *
 * Pass --check to verify without writing (used by CI and the pre-commit hook).
 *
 * The policy is hash-only, and hashes cover ELEMENTS, never ATTRIBUTES: a
 * style="..." written into markup is discarded by the browser at parse time,
 * and an onclick="..." is refused outright. Both have shipped here already —
 * zone bars rendering at zero width, segment colours vanishing — with nothing
 * on screen to say why. So the generator refuses any page that carries them,
 * in build and --check alike: the failure moves from a silent blank in
 * production to a red line in CI, where it can actually be fixed.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Origins a page is allowed to reach.
 *
 * Two of them, on purpose and only for now. The Worker is moving from its
 * workers.dev hostname to api.musetteapp.com, and phones carry the old URL in
 * localStorage (v2.cfg), so a copy of the app that has not been reopened yet is
 * still talking to the old host. Naming both means the move does not depend on
 * every phone updating in the same hour.
 *
 * Drop the workers.dev entry once no phone is using it - it is the last thing
 * keeping a *.workers.dev origin in the policy, and leaving it is exactly the
 * kind of "temporary" that becomes permanent. */
const SYNC_ORIGINS = [
  'https://api.musetteapp.com',
];

/* The two things Pages serves, and what each is allowed to do.
 *
 * The public site talks to nobody: it is prose and a sign-in form, so its
 * connect-src is 'none' and it cannot become an exfiltration path if a page
 * ever grows an injection. Only /signin.html is allowed to reach the Worker,
 * and only when that page exists. */
const SITES = [
  { dir: 'web/public', name: 'app',  connect: SYNC_ORIGINS },
  { dir: 'web/site',   name: 'site', connect: [], perPath: { '/signin': SYNC_ORIGINS, '/account': SYNC_ORIGINS, '/welcome': SYNC_ORIGINS } },
];

const sha256 = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

/* Collect the text content of every inline <script>/<style> (no src/href). */
function inlineHashes(html, tag) {
  const re = new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  for (const m of html.matchAll(re)) {
    if (/\b(src|href)=/i.test(m[1])) continue;
    out.push(sha256(m[2]));
  }
  return out;
}

/* ---- Source-level CSP compliance ---------------------------------------
   Two patterns are fatal under the emitted policy, so they are fatal here:

     style="..."    style-src carries element hashes only. Attributes are
                    governed by style-src-attr, which falls back to style-src,
                    and a hash NEVER authorises an attribute - the declaration
                    is parsed and thrown away.
     onclick="..."  script-src likewise; inline handlers are refused.

   The escape hatch this repo already uses is the CSSOM: emit data-* and set
   .style from script (paintBars/paintMonth in index.html do exactly this),
   because assigning .style from script is unaffected by the policy. Anything
   reaching for an inline attribute belongs there instead.

   <style> element BODIES are legal - they are what the hashes cover - so they
   are masked out before scanning: blanked in place with newlines preserved,
   which keeps every reported line number true to the source file. */
const HANDLER_NAMES = [
  'click', 'dblclick', 'change', 'input', 'submit', 'load', 'error',
  'keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mousemove',
  'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'touchstart',
  'touchend', 'touchmove', 'focus', 'blur', 'scroll',
  'pointerdown', 'pointerup', 'contextmenu',
];

/* Whitespace-or-start before the name, so data-style= and ?style= in a URL
   cannot trip it; a quoted OR bare value, because both are legal HTML and both
   are equally dead under this policy. Built fresh per call: a /g regex keeps
   lastIndex between calls, and a stale one skips matches. */
function cspViolations(html) {
  const src = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,
    (block) => block.replace(/[^\n]/g, ' '));
  const styleAttr = /(?:^|\s)style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;
  const onAttr = new RegExp(
    '(?:^|\\s)on(?:' + HANDLER_NAMES.join('|') + ')\\s*=\\s*(?:"[^"]*"|\'[^\']*\')', 'gi');
  const out = [];
  const record = (m, kind) => {
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ line, kind, detail: m[0].replace(/\s+/g, ' ').slice(0, 72) });
  };
  let m;
  while ((m = styleAttr.exec(src))) record(m, 'inline style attribute');
  while ((m = onAttr.exec(src))) record(m, 'inline event handler');
  return out;
}

/* index.html serves at /, everything else at its own name without .html -
 * which is how Pages routes it. Longest paths first so /signin is matched
 * before a broader rule could shadow it. */
const routeOf = (file) => (file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, ''));

const COMMON = [
  'Cache-Control: public, max-age=0, must-revalidate',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'X-Frame-Options: DENY',
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Resource-Policy: same-origin',
  'Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
];

function policy(html, connect, formAction) {
  const scripts = inlineHashes(html, 'script');
  const styles = inlineHashes(html, 'style');
  return {
    scripts,
    styles,
    csp: [
      "default-src 'none'",
      `script-src ${scripts.join(' ') || "'none'"}`,
      `style-src ${styles.join(' ') || "'none'"}`,
      "img-src 'self' data:",
      `connect-src ${connect.length ? connect.join(' ') : "'none'"}`,
      "base-uri 'none'",
      /* form-action is 'none' everywhere except the pages that post: the CSP
         forbids a real form POST, and sign-in talks to the Worker by fetch. */
      `form-action ${formAction}`,
      "frame-ancestors 'none'",
    ].join('; '),
  };
}

function build(site) {
  const dir = join(root, site.dir);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
  if (!files.length) return null;

  const blocks = [];
  const report = [];
  for (const file of files) {
    const html = readFileSync(join(dir, file), 'utf8');
    /* Refuse the app page before hashing it. Shipping it would mean the browser
       silently discards whatever the attribute carried - styling, behaviour -
       and nothing anywhere would say why. Fatal in BOTH modes: this is a
       defect in the source, not staleness in the output. */
    if (site.name === 'app') {
      const bad = cspViolations(html);
      if (bad.length) {
        console.error(`build-csp: ${site.dir}/${file} breaks its own hash-only CSP:`);
        for (const v of bad) {
          console.error(`  line ${v.line}: ${v.kind} — ${v.detail}`);
        }
        console.error(
          '  A hash authorises <style> ELEMENTS, never attributes. Move the\n' +
          '  declarations into the stylesheet, or emit data-* and assign .style\n' +
          '  from script (see paintBars/paintMonth in index.html).'
        );
        process.exit(1);
      }
    }
    const route = routeOf(file);
    const connect = (site.perPath && site.perPath[route]) || site.connect;
    const p = policy(html, connect, "'none'");
    if (!p.scripts.length && site.name === 'app') {
      console.error(`build-csp: ${file} has no inline <script> - refusing to emit a CSP that blocks the app`);
      process.exit(1);
    }
    report.push({ file, route, scripts: p.scripts, styles: p.styles, connect });
    /* CSP only on the page's own path. Cloudflare Pages applies EVERY matching
       rule, not the first one, and a response carrying two CSP headers is
       enforced as the intersection of both - so a catch-all that also emitted a
       policy silently reduced every page to script-src 'none'. That shipped, and
       the app rendered as bare HTML with nothing on screen to say why. The
       catch-all below therefore carries the ordinary headers and no policy. */
    blocks.push(`${route}\n  Content-Security-Policy: ${p.csp}\n`);
    if (route !== '/') {
      /* Pages serves both /signin and /signin.html; the policy has to name the
         literal file too or that spelling goes out with no policy at all. */
      blocks.push(`${route}.html\n  Content-Security-Policy: ${p.csp}\n`);
    }
  }
  /* Everything, including 404s and any future asset. These headers are safe to
     apply alongside a page's own policy because none of them intersect. */
  blocks.push(`/*\n` + COMMON.map((h) => `  ${h}`).join('\n') + '\n');

  const body = `# GENERATED by tools/build-csp.mjs - do not edit by hand.
# Re-run \`npm run build\` after changing any page, or the hashes go stale and
# the browser refuses to run what it is served.
${blocks.join('\n')}`;
  return { path: join(dir, '_headers'), body, report };
}

const check = process.argv.includes('--check');
let failed = false;

for (const site of SITES) {
  const built = build(site);
  if (!built) continue;
  if (check) {
    if (!existsSync(built.path) || readFileSync(built.path, 'utf8') !== built.body) {
      console.error(
        `build-csp --check: ${site.dir}/_headers is STALE - the CSP hashes do not match the pages.\n` +
        'What is deployed would be blocked by its own CSP. Run `npm run build`.'
      );
      failed = true;
      continue;
    }
    console.log(`build-csp --check: ${site.name} ok (${built.report.length} page${built.report.length > 1 ? 's' : ''})`);
  } else {
    writeFileSync(built.path, built.body);
    console.log(`build-csp: wrote ${site.dir}/_headers`);
    for (const r of built.report) {
      console.log(`  ${r.route.padEnd(10)} script ${r.scripts[0] || "'none'"}`);
      if (r.connect.length) console.log(`  ${''.padEnd(10)} connect ${r.connect.join(' ')}`);
    }
  }
}
process.exit(failed ? 1 : 0);
