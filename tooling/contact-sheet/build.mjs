/**
 * The contact sheet: every screenshot in the repository on one page, grouped by capture round.
 *
 * Two outputs, because they answer different questions.
 *
 * `docs/CONTACT-SHEET.md` references the PNGs by relative path, so it renders as a real contact
 * sheet on GitHub and in any editor that previews markdown, and it costs nothing in repository size.
 * That is the one a reviewer looking at a pull request sees.
 *
 * `docs/CONTACT-SHEET.html` embeds downscaled thumbnails, so it is a single file that can be opened
 * or hosted anywhere with no repository beside it. Thumbnails rather than the originals because the
 * originals are 33 MB and a page nobody can load is not a contact sheet.
 *
 * Run with `pnpm contact-sheet`.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'SCREENSHOTS');

/** Capture rounds in the order they happened, so the sheet reads as a history rather than a listing. */
const ORDER = ['phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'classification', 'nmds', 'security', 'dialogs', 'layout', 'links', 'sign-in', 'clock', 'create', 'network', 'terminal', 'two-way', 'simulator', 'flows', 'search', 'demo', 'compare', 'recording'];

/** What each round was. A contact sheet with no captions is a wall of thumbnails. */
const ROUND_NOTES = {
  'phase-1': 'Foundation: the shell, sign-in, Home and the design system in use.',
  'phase-2': 'The Person record, the Integrated Chronology and the connector inbox.',
  'phase-3': 'Process dashboards for ASP, CP, MARAC, MAPPA and AWI, and the eight scenarios.',
  'phase-4': 'The meeting workspace, actions, sharing and the need-to-know admin.',
  'phase-5': 'Connectors, the five inspection reports, the audit ledger, Admin, Settings and Help.',
  'phase-6': 'The dark and compact sweep of every screen, plus print and the 1024 wide check.',
  classification: 'Government Security Classification: what is marked, what is not, and the derivation rules.',
  nmds: 'The ASP data workbook return, previewed against the cells it writes to.',
  security: 'The cryptographic architecture made inspectable: what the host can see, the audit chain, statutory disclosure and the Security page.',
  dialogs: 'The one dialog primitive: a statutory form taller than the viewport, scrolling its body and keeping its footer, in both themes.',
  layout: 'The four layout modes: the same person record docked, compact and as panels.',
  links: 'The product as a web of records: a practitioner card, the case-party register, an unentitled landing and where you have been.',
  'sign-in': 'Choosing who you are, rebuilt: one surface, the honest statement second, both questions at once and the keyboard first.',
  clock: 'The settable demo clock, which every statutory clock and every relative date in the product is computed against.',
  network: 'Starting a process behind two gates that explain themselves, and household and network kept apart, and what changing either one does: the open cases a household change touches, and the exclusion a relationship creates, both computed and shown before the button.',
  simulator: 'The other side of the connector: a deliberately plain mock of a partner system, so two-way integration can be filmed from both ends. Plainer, denser, older, with a neutral name and a banner saying it is simulated. The wiring is real: an episode created there arrives here as a proposal, and one edited there produces a divergence on the reconciliation screen.',
  'two-way': 'Connectors in both directions. The capability matrix that refuses to claim what is not realistic, the outbox with a delivery state a person can see, the payload preview in the target system\'s own field names, the echo defence that recognises our own write coming back, and the reconciliation screen almost no product demo has.',
  terminal: 'The other half of a records system: editing, correcting, closing, reopening, retiring and recording a death. Nothing here deletes. A closed case keeps its deadlines and can be reopened; a retired chronology entry is off the working list and still on the record; a corrected date of birth leaves the value it used to hold on screen with the reason it changed.',
  recording: 'Every screen under the recording preset at 1920x1080: every type size a step larger, comfortable density, no looping animation. Video compression eats small text, and the audience for a recording is further from the screen than a practitioner ever is.',
  compare: 'Two people, one record, one window, at 1920x1080. The panels are the real screens rather than a summary of what the rules would say, and the third panel is the hosting provider: practitioner, partner agency and host in one frame.',
  demo: 'The demo control panel, which is not part of the product and says so. Hidden behind Control, Shift and D and absent from a production build. Twelve chapters that each set the persona, the route, the appearance and the clock in one click; persona switching without the account menu; the clock; saved states for a second take; connector outages; and the reset that takes the clock and any break-glass grant with it.',
  search: 'Search over the records the reader can open. The typeahead reaching past people and case references into meetings, actions and chronology entries; the results grouped by type; and the same query typed by somebody who holds no key for the case, which finds the reference, refuses the rest and says how many cases it could not search.',
  flows: 'The eight named flows walked end to end rather than described: the three-point test computing its own outcome, the IRD with four agencies and a recorded dissent, the MARAC and child protection chain clicked from one case to the other, the workbook export naming the cells it fills, and the persona proof, where the same case gives three people three different answers and the third is refused by name.',
  create: 'Making a record. Adding a person begins with looking for them: the search, the candidates with the reason each matched, the form that only opens once they have been dismissed, the refusal for a role that does not hold cases, and the merge, which is destructive and therefore reversible. Then the rest of the create paths, each showing the consequence before the button: the outcomes that are the plan, the alert and who can see it, the clocks a granted protection order starts, the facts a disclosure is limited to, and the global create action that reaches them all from anywhere.',
};

/** Rounds, each with its screenshots, newest round last. */
function rounds() {
  const dirs = readdirSync(SHOTS).filter((name) => statSync(join(SHOTS, name)).isDirectory());
  const ranked = [...dirs].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib) || a.localeCompare(b);
  });
  return ranked.map((name) => ({
    name,
    note: ROUND_NOTES[name] ?? '',
    shots: readdirSync(join(SHOTS, name))
      .filter((file) => file.endsWith('.png'))
      .sort()
      .map((file) => ({ file, path: join(SHOTS, name, file) })),
  }));
}

/** "person-record-voice-light-comfortable" reads as "Person record voice", light, comfortable. */
function describe(file) {
  const base = file.replace(/\.png$/, '');
  const match = /^(.*)-(light|dark)-(comfortable|compact)$/.exec(base);
  if (!match) return { screen: base.replace(/-/g, ' '), theme: '', density: '' };
  return { screen: match[1].replace(/-/g, ' '), theme: match[2], density: match[3] };
}

/**
 * One width, used in both places.
 *
 * The sheet used to carry each capture twice: a 420px thumbnail for the grid and a 1280px copy for
 * the lightbox. A 420px thumbnail of a 1440px screen is 29 percent of native, which is enough to
 * recognise a screen you already know and not enough to read one you do not, so telling two similar
 * captures apart meant opening both. Two encodings of the same picture also cost 12.6 MB, and
 * raising the thumbnail to a legible size on top of that went past the 16 MB the page has to fit in.
 *
 * So the second encoding pays for the first. A single 1280px image serves the grid card, where the
 * browser downsamples it to the column width and the text stays crisp, and the lightbox, where it is
 * shown at full size. The page came down to 10.6 MB in the process. `loading="lazy"` keeps the
 * decode cost to what is near the viewport, which is what makes one large source per card viable.
 */
const GALLERY_WIDTH = 1280;

/**
 * The size the single file has to stay under, and what to do when it does not.
 *
 * A guard rather than a comment, because the number was written down once and then twenty-five more
 * captures arrived. When this fails the answer is one of three things, in order: drop the quality a
 * few points, drop the width, or split the sheet by round. It is not to quietly stop capturing.
 */
const MAX_BYTES = 16 * 1024 * 1024;
const QUALITY = 44;

async function encode(path, width, quality) {
  const buffer = await sharp(path).resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

const gallery = (path) => encode(path, GALLERY_WIDTH, QUALITY);

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const all = rounds();
const total = all.reduce((n, round) => n + round.shots.length, 0);
const today = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ markdown */

const md = [
  '# Contact sheet',
  '',
  `Every screenshot in the repository, ${total} of them across ${all.length} capture rounds, grouped in the order the rounds happened. **Generated by \`pnpm contact-sheet\`. Do not edit by hand.**`,
  '',
  'Light comfortable is the default. Dark and compact variants appear where a round captured them. `docs/HANDOVER.md` section 5 has the same list as a table without the images.',
  '',
];
for (const round of all) {
  md.push(`## ${round.name}`, '', round.note, '');
  for (const shot of round.shots) {
    const { screen, theme, density } = describe(shot.file);
    const caption = theme ? `${screen} (${theme}, ${density})` : screen;
    md.push(`### ${caption}`, '', `![${caption}](SCREENSHOTS/${round.name}/${shot.file})`, '');
  }
}
writeFileSync(join(ROOT, 'docs', 'CONTACT-SHEET.md'), `${md.join('\n').trimEnd()}\n`);

/* ---------------------------------------------------------------------- html */

const sections = [];
/**
 * Captions and paths for the lightbox, indexed to match the cards. The image itself is not in here:
 * the viewer reads it from the card's own `<img>`, because putting the same base64 in a JSON blob as
 * well would put every capture in the file twice again, which is the thing this stopped doing.
 */
const captions = [];
let index = 0;
for (const round of all) {
  const cards = [];
  for (const shot of round.shots) {
    const { screen, theme, density } = describe(shot.file);
    const src = await gallery(shot.path);
    captions.push({ screen, meta: theme ? `${theme}, ${density}` : 'single capture', path: relative(ROOT, shot.path) });
    const meta = theme ? `${theme}, ${density}` : 'single capture';
    cards.push(
      `<figure class="shot" data-theme-variant="${theme || 'none'}" data-density="${density || 'none'}">` +
        `<button type="button" class="open" data-index="${index}" aria-label="Open ${escapeHtml(screen)}, ${escapeHtml(meta)}, at full size">` +
        `<img loading="lazy" decoding="async" src="${src}" alt="${escapeHtml(screen)}, ${escapeHtml(meta)}" width="${GALLERY_WIDTH}"></button>` +
        `<figcaption><span class="screen">${escapeHtml(screen)}</span>` +
        (theme ? `<span class="chips"><span class="chip chip-${theme}">${theme}</span><span class="chip chip-${density}">${density}</span></span>` : '<span class="chips"><span class="chip">single capture</span></span>') +
        `<code>${escapeHtml(relative(ROOT, shot.path))}</code></figcaption></figure>`,
    );
    index += 1;
  }
  sections.push(
    `<section id="${round.name}"><div class="round-head"><h2>${round.name}</h2><span class="count">${round.shots.length} captures</span></div>` +
      `<p class="note">${escapeHtml(round.note)}</p><div class="grid">${cards.join('')}</div></section>`,
  );
}

const nav = all.map((round) => `<a href="#${round.name}">${round.name}<span>${round.shots.length}</span></a>`).join('');

/**
 * The palette is the product's own, read from apps/web/styles/tokens.css: warm paper, heather
 * accent, the same ink steps. An index painted in a different palette from the thing it indexes
 * would be the first thing a designer noticed.
 */
const html = `<title>Person360 Contact Sheet</title>
<style>
  :root {
    color-scheme: light;
    --paper-0: #fcfaf5;
    --paper-1: #f6f2ea;
    --paper-2: #eee8dc;
    --line-1: #e3dbcc;
    --line-2: #cfc5b2;
    --ink-1: #22201b;
    --ink-2: #514b41;
    --ink-3: #6f6759;
    --accent: #4f3d8b;
    --accent-soft: #eee9f7;
    --shadow: 0 1px 2px rgba(34, 32, 27, 0.06);
    --sans: 'Atkinson Hyperlegible', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      color-scheme: dark;
      --paper-0: #1a1815;
      --paper-1: #221f1b;
      --paper-2: #2c2823;
      --line-1: #3a352e;
      --line-2: #4c463d;
      --ink-1: #f1ece2;
      --ink-2: #cfc7b8;
      --ink-3: #a09884;
      --accent: #b9a7ea;
      --accent-soft: #2b2440;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }
  }
  :root[data-theme='dark'] {
    color-scheme: dark;
    --paper-0: #1a1815;
    --paper-1: #221f1b;
    --paper-2: #2c2823;
    --line-1: #3a352e;
    --line-2: #4c463d;
    --ink-1: #f1ece2;
    --ink-2: #cfc7b8;
    --ink-3: #a09884;
    --accent: #b9a7ea;
    --accent-soft: #2b2440;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0 32px 72px;
    background: var(--paper-0);
    color: var(--ink-1);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 3;
    margin: 0 -32px 36px;
    padding: 24px 32px 14px;
    background: color-mix(in srgb, var(--paper-0) 94%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line-1);
  }
  .masthead { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 14px; }
  h1 { margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -0.015em; }
  .tally { color: var(--ink-3); font-size: 13px; font-variant-numeric: tabular-nums; }
  .lede { margin: 8px 0 16px; max-width: 82ch; color: var(--ink-2); font-size: 14px; text-wrap: pretty; }

  .controls { display: flex; flex-wrap: wrap; gap: 16px 26px; align-items: center; }
  nav { display: flex; flex-wrap: wrap; gap: 6px; }
  nav a {
    display: inline-flex; align-items: baseline; gap: 6px;
    padding: 3px 11px;
    color: var(--ink-2); font-size: 13px; text-decoration: none;
    border: 1px solid var(--line-1); border-radius: 999px;
  }
  nav a:hover { color: var(--ink-1); border-color: var(--line-2); }
  nav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  nav a span { color: var(--ink-3); font-size: 11px; font-variant-numeric: tabular-nums; }

  .filter { display: flex; align-items: center; gap: 8px; }
  .filter-label { color: var(--ink-3); font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; }
  .filter button {
    padding: 3px 11px;
    color: var(--ink-2); font-family: inherit; font-size: 13px;
    background: transparent; border: 1px solid var(--line-1); border-radius: 999px;
    cursor: pointer;
  }
  .filter button:hover { color: var(--ink-1); border-color: var(--line-2); }
  .filter button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .filter button[aria-pressed='true'] { color: var(--accent); background: var(--accent-soft); border-color: var(--accent); }

  section { margin: 0 0 52px; scroll-margin-top: 150px; }
  .round-head {
    display: flex; align-items: baseline; gap: 12px;
    padding-bottom: 7px;
    border-bottom: 2px solid var(--accent);
  }
  h2 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.01em; }
  .count { color: var(--ink-3); font-size: 12px; font-variant-numeric: tabular-nums; }
  .note { margin: 10px 0 20px; max-width: 72ch; color: var(--ink-2); font-size: 14px; text-wrap: pretty; }

  .grid { display: grid; gap: 26px 22px; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); }
  figure { display: flex; flex-direction: column; margin: 0; }
  .open {
    display: block; padding: 0; width: 100%;
    background: transparent; border: 0; border-radius: 4px;
    cursor: zoom-in;
  }
  .open:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  figure img {
    display: block; width: 100%; height: auto;
    background: var(--paper-1);
    border: 1px solid var(--line-1); border-radius: 4px;
    box-shadow: var(--shadow);
  }
  .open:hover img { border-color: var(--accent); }
  figcaption { display: flex; flex-direction: column; gap: 3px; margin-top: 9px; }
  .screen { font-size: 14px; line-height: 1.3; }
  .chips { display: flex; gap: 5px; }
  .chip {
    padding: 1px 7px;
    color: var(--ink-3); font-size: 11px; letter-spacing: 0.03em;
    border: 1px solid var(--line-1); border-radius: 3px;
  }
  .chip-dark { color: var(--accent); border-color: var(--accent); }
  figcaption code { color: var(--ink-3); font-family: var(--mono); font-size: 10.5px; word-break: break-all; }

  /* The filter hides cards rather than reordering them, so a round with nothing matching still
     shows its heading and count: "phase-1 has no compact captures" is information. */
  body[data-filter='dark'] .shot:not([data-theme-variant='dark']),
  body[data-filter='light'] .shot:not([data-theme-variant='light']),
  body[data-filter='compact'] .shot:not([data-density='compact']) { display: none; }

  /* The lightbox. A native dialog, so Escape closes it and focus is trapped without any of that
     being hand-written; the image is the only thing that scrolls, because a full-page capture is
     four thousand pixels tall and the caption should stay put while a reader moves down it. */
  dialog {
    width: min(96vw, 1360px); max-width: none; height: min(94vh, 100%); max-height: none;
    padding: 0;
    color: var(--ink-1); background: var(--paper-0);
    border: 1px solid var(--line-2); border-radius: 8px;
  }
  dialog::backdrop { background: rgba(12, 10, 8, 0.72); }
  .viewer { display: grid; grid-template-rows: auto 1fr; height: 100%; }
  .viewer-bar {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line-1);
  }
  .viewer-title { font-size: 15px; font-weight: 700; }
  .viewer-meta { color: var(--ink-3); font-size: 12px; }
  .viewer-path { color: var(--ink-3); font-family: var(--mono); font-size: 11px; word-break: break-all; }
  .viewer-actions { display: flex; gap: 6px; margin-left: auto; }
  .viewer-actions button {
    padding: 3px 11px;
    color: var(--ink-2); font-family: inherit; font-size: 13px;
    background: transparent; border: 1px solid var(--line-1); border-radius: 999px;
    cursor: pointer;
  }
  .viewer-actions button:hover { color: var(--ink-1); border-color: var(--line-2); }
  .viewer-actions button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .viewer-stage { overflow: auto; padding: 16px; background: var(--paper-1); }
  .viewer-stage img { display: block; width: 100%; height: auto; margin: 0 auto; max-width: 1280px; }

  footer {
    max-width: 72ch; padding-top: 18px;
    color: var(--ink-3); font-size: 13px;
    border-top: 1px solid var(--line-1);
  }
  footer code { font-family: var(--mono); font-size: 12px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
<header>
  <div class="masthead">
    <h1>Person360 contact sheet</h1>
    <span class="tally">${total} captures, ${all.length} rounds, generated ${today}</span>
  </div>
  <p class="lede">Every screenshot in the repository, in the order the rounds happened. All are captured by the Playwright suite at 1440 by 900 and embedded at ${GALLERY_WIDTH} wide, so a card is readable in the grid rather than only recognisable; every captured screen passes axe against the WCAG 2.2 AA tags. Light comfortable is the default; dark and compact appear where a round captured them. Click any capture to open it at full size, then use the arrow keys to walk the round.</p>
  <div class="controls">
    <nav aria-label="Capture rounds">${nav}</nav>
    <div class="filter" role="group" aria-label="Filter by variant">
      <span class="filter-label" id="filter-label">Show</span>
      <button type="button" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-filter="light" aria-pressed="false">Light</button>
      <button type="button" data-filter="dark" aria-pressed="false">Dark</button>
      <button type="button" data-filter="compact" aria-pressed="false">Compact</button>
    </div>
  </div>
</header>
${sections.join('\n')}
<footer>Generated by <code>pnpm contact-sheet</code> from <code>docs/SCREENSHOTS/</code>; the originals are there at their captured size. Everything shown is synthetic: fictional people, invented places, postcodes in the Q, V and X ranges and generated CHI numbers. Nothing in this product connects to a live system.</footer>

<dialog id="viewer" aria-label="Screenshot">
  <div class="viewer">
    <div class="viewer-bar">
      <span class="viewer-title" id="viewer-title"></span>
      <span class="viewer-meta" id="viewer-meta"></span>
      <span class="viewer-path" id="viewer-path"></span>
      <div class="viewer-actions">
        <button type="button" id="viewer-prev">Previous</button>
        <button type="button" id="viewer-next">Next</button>
        <button type="button" id="viewer-close">Close</button>
      </div>
    </div>
    <div class="viewer-stage"><img id="viewer-image" alt=""></div>
  </div>
</dialog>

<script id="shots" type="application/json">${JSON.stringify(captions).replace(/</g, '\\u003c')}</script>
<script>
  const buttons = document.querySelectorAll('.filter button');
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const value = button.dataset.filter;
      document.body.dataset.filter = value === 'all' ? '' : value;
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    });
  }

  const shots = JSON.parse(document.getElementById('shots').textContent);
  const viewer = document.getElementById('viewer');
  const image = document.getElementById('viewer-image');
  const stage = document.querySelector('.viewer-stage');
  let current = 0;

  function show(i) {
    const shot = shots[i];
    const card = document.querySelector('.open[data-index="' + i + '"] img');
    if (!shot || !card) return;
    current = i;
    // The same image the card shows, at its own size rather than the column's. One copy in the file.
    image.src = card.src;
    image.alt = shot.screen + ', ' + shot.meta;
    document.getElementById('viewer-title').textContent = shot.screen;
    document.getElementById('viewer-meta').textContent = shot.meta;
    document.getElementById('viewer-path').textContent = shot.path;
    stage.scrollTop = 0;
  }

  /** Next and previous walk what is on screen, so a filtered sheet steps through the filtered set. */
  function visibleIndexes() {
    return [...document.querySelectorAll('.shot')]
      .filter((figure) => figure.offsetParent !== null)
      .map((figure) => Number(figure.querySelector('.open').dataset.index));
  }

  function step(by) {
    const visible = visibleIndexes();
    const at = visible.indexOf(current);
    const next = visible[(at + by + visible.length) % visible.length];
    if (next !== undefined) show(next);
  }

  for (const open of document.querySelectorAll('.open')) {
    open.addEventListener('click', () => {
      show(Number(open.dataset.index));
      viewer.showModal();
    });
  }
  document.getElementById('viewer-close').addEventListener('click', () => viewer.close());
  document.getElementById('viewer-next').addEventListener('click', () => step(1));
  document.getElementById('viewer-prev').addEventListener('click', () => step(-1));
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  });
  // Clicking the backdrop, which for a native dialog means a click landing on the dialog itself.
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) viewer.close();
  });
</script>
`;

if (!existsSync(join(ROOT, 'docs'))) mkdirSync(join(ROOT, 'docs'));
writeFileSync(join(ROOT, 'docs', 'CONTACT-SHEET.html'), html);
if (Buffer.byteLength(html) > MAX_BYTES) {
  console.error(`contact sheet is ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB, past the ${MAX_BYTES / 1024 / 1024} MB it has to fit in. Lower QUALITY, lower GALLERY_WIDTH, or split the sheet by round.`);
  process.exit(1);
}
console.log(`contact sheet: ${total} screenshots in ${all.length} rounds, ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB (one ${GALLERY_WIDTH}px image per capture, shared by the grid and the viewer)`);
