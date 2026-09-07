/**
 * The guard that stops the dialog centring bug coming back.
 *
 * Every modal in the product rendered pinned to the top left because Tailwind's preflight emits
 * `*, ::after, ::before, ::backdrop { margin: 0 }`, which zeroes the user agent's
 * `dialog { margin: auto }`, and that margin against two zero insets is what centres a modal.
 * Nobody wrote the bug; a framework upgrade brought it, and no test could see it because the
 * dialogs still opened and still had the right width.
 *
 * So this reads the compiled CSS rather than the source, because the source is not where the
 * problem was, and asserts two things: that some rule sets `margin: auto` on the dialog class, and
 * that no rule after it in the cascade takes it away. Run as part of `pnpm lint`, after `pnpm build`
 * has produced the export. With nothing built to read it fails and says what to run, because a
 * guard that passes when it has checked nothing is the one thing a guard must not do: a fresh clone
 * that passed `pnpm lint` without a build could not have caught the bug this exists for (D-203).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'apps', 'web', 'out');

function cssFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...cssFiles(path));
    else if (entry.endsWith('.css')) found.push(path);
  }
  return found;
}

if (!existsSync(OUT)) {
  console.error('dialog margin guard failed: there is no export at apps/web/out to read, so nothing has been checked.');
  console.error('Run `pnpm build` first; `pnpm lint` reads the compiled CSS and cannot pass without it.');
  process.exit(1);
}

const files = cssFiles(OUT);
if (files.length === 0) {
  console.error('dialog margin guard failed: the export at apps/web/out has no CSS in it, so nothing has been checked.');
  console.error('Run `pnpm build` again; `pnpm lint` reads the compiled CSS and cannot pass without it.');
  process.exit(1);
}

const problems = [];
let sawAuto = false;

for (const file of files) {
  const css = readFileSync(file, 'utf8');

  // The rule that does the centring. The class is hashed by CSS modules, so match the declaration
  // block that also carries the fixed position and the zero inset, which is the shape we wrote.
  if (/margin:auto/.test(css) && /position:fixed/.test(css) && /inset:0/.test(css)) sawAuto = true;

  // Anything that targets the dialog box itself and zeroes its margin. The universal preflight
  // selector is allowed: it is what we are defending against, and our own rule outranks it. What is
  // not allowed is a later, more specific rule undoing the fix.
  //
  // "The dialog box itself" is the `dialog` element or the `.dialog` class a CSS module compiled to
  // a hashed name ending `__dialog`. Matching the word anywhere in a selector was too broad: a
  // stylesheet named after a dialog compiles every one of its classes to a name containing
  // "dialog", so a paragraph inside a dialog body resetting its own margin failed the guard, which
  // is a false alarm that trains people to ignore a real one.
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    const targetsBox = /(^|[\s,>+~([])dialog\b/i.test(selector) || /__dialog(?![A-Za-z0-9])/.test(selector);
    if (!targetsBox) continue;
    if (/(^|;)\s*margin:\s*0(px)?\s*(;|$)/.test(body)) {
      problems.push(`${file.replace(process.cwd() + '/', '')}: ${selector.trim()} sets margin: 0`);
    }
  }
}

if (!sawAuto) {
  problems.push('no rule sets `position: fixed; inset: 0; margin: auto` on the dialog: the centring is gone');
}

if (problems.length > 0) {
  console.error('dialog margin guard failed. A modal centres because `margin: auto` resolves against two zero insets:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nSee packages/ui/src/primitives/Dialog.module.css.');
  process.exit(1);
}

console.log(`dialog margin guard: centring intact across ${files.length} compiled stylesheets`);
