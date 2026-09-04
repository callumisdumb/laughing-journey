/**
 * Checks that the shooting script still fits its slots. Brief section G.5.
 *
 * "Timed" has to mean something or it is a word in a heading. Each chapter of `docs/DEMO.md`
 * declares a duration and carries a table whose Say column is what gets read aloud, so the check is
 * arithmetic: words divided by a reading rate against the seconds available. 150 words a minute is
 * a deliberate presenting pace, slower than conversation, and it is the rate the script was written
 * at rather than a number that makes the answer come out right.
 *
 * It also adds the chapters up and compares the total against the one in the runtime table, because
 * the two drifting apart is the thing nobody notices until the edit.
 *
 * A chapter that is over is not a disaster: cut a sentence, or raise the slot and the total. What
 * this stops is a script that quietly grew to fourteen minutes while still calling itself eleven.
 */
import { readFileSync } from 'node:fs';

const SCRIPT = 'docs/DEMO.md';
const WORDS_PER_MINUTE = 150;
/** Room for a pause and a click. A chapter reading at 95 percent of its slot is not shootable. */
const HEADROOM = 0.85;

const text = readFileSync(SCRIPT, 'utf8');
const lines = text.split('\n');

function seconds(stamp) {
  const [m, s] = stamp.split(':').map(Number);
  return m * 60 + s;
}

const chapters = [];
let current = null;
for (const line of lines) {
  const heading = /^## Chapter (\d+)\.\s+(.+)$/.exec(line);
  if (heading) {
    current = { number: Number(heading[1]), title: heading[2], duration: 0, words: 0 };
    chapters.push(current);
    continue;
  }
  if (!current) continue;
  if (/^## /.test(line)) {
    current = null;
    continue;
  }
  const duration = /\*\*Duration:\*\*\s*(\d+:\d{2})/.exec(line);
  if (duration) {
    current.duration = seconds(duration[1]);
    continue;
  }
  // A beat row: | id | do | say | look at |
  if (line.startsWith('|') && !line.startsWith('|---') && !/^\|\s*Beat\s*\|/.test(line)) {
    const cells = line.split('|').slice(1, -1);
    if (cells.length < 4) continue;
    const say = cells[2].replace(/^\s*"|"\s*$/g, '').trim();
    current.words += say.split(/\s+/).filter(Boolean).length;
  }
}

if (chapters.length === 0) {
  console.error(`demo:check found no chapters in ${SCRIPT}`);
  process.exit(1);
}

const problems = [];
for (const chapter of chapters) {
  if (chapter.duration === 0) {
    problems.push(`chapter ${chapter.number} (${chapter.title}) has no duration`);
    continue;
  }
  const readSeconds = (chapter.words / WORDS_PER_MINUTE) * 60;
  const allowed = chapter.duration * HEADROOM;
  if (readSeconds > allowed) {
    problems.push(`chapter ${chapter.number} (${chapter.title}): ${chapter.words} words is ${readSeconds.toFixed(0)}s of narration, past the ${allowed.toFixed(0)}s available in a ${chapter.duration}s slot`);
  }
}

const declared = /\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+:\d{2})\*\*\s*\|/.exec(text);
if (!declared) problems.push('no total runtime row in the runtime table');
else {
  const summed = chapters.reduce((n, c) => n + c.duration, 0);
  if (summed !== seconds(declared[1])) problems.push(`the chapters add up to ${Math.floor(summed / 60)}:${String(summed % 60).padStart(2, '0')} and the total says ${declared[1]}`);
}

if (problems.length > 0) {
  console.error(`demo:check found ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

const total = chapters.reduce((n, c) => n + c.duration, 0);
const words = chapters.reduce((n, c) => n + c.words, 0);
console.log(`demo:check passed: ${chapters.length} chapters, ${words} words of narration, ${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} runtime at ${WORDS_PER_MINUTE} words a minute`);
