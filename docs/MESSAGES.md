# Messages: the editable copy catalogue

Every string a person can see or hear in the platform lives in one file, `packages/messages/src/en-GB.json`, and nowhere else. Someone who is not a developer can open that file, or the Admin screen "Copy and labels", change a label and see the change without touching a component. The mockup is single-locale (British English, Scottish terminology); the structure lets a second locale file be dropped in later without code changes.

## What lives in the catalogue

Navigation labels, page titles, headings, tab names, table column headers, button and menu labels, form field labels, placeholders, help text, validation messages, tooltips, `aria-label` and `title` attributes, visually hidden text, toast and dialog copy, every state (empty, loading, error, restricted, offline, stale), confirmation prompts, keyboard shortcut descriptions, print pack headers and footers, classification markings, the domain vocabulary (process names and codes, stage names, event type labels, agency and role names, risk bands, clock rule labels and descriptions, harm types, register categories, capacity outcomes, meeting types, notification detail levels, connector display names and their "how this would connect for real" copy), the glossary and first-use tooltips, report titles and table headings, and the desktop shell menus and About dialog.

Not in the catalogue: synthetic data (names, addresses, chronology facts, minutes text from the seed), identifiers and reference numbers, log lines, developer-facing console errors and code comments. Dates, times and numbers are never written into messages; they are formatted with the `Intl` helpers in `@mas/messages` (`formatDate` gives dd Mon yyyy, `formatTime` the 24-hour clock, both in Europe/London) and passed into messages as arguments.

## Conventions

- ICU MessageFormat throughout: `{name}` for interpolation, `{count, plural, one {# action} other {# actions}}` for plurals, `{role, select, chair {the chair} other {a member}}` for variants. No string concatenation in components.
- Nested JSON, one top-level key per namespace: `common`, `nav`, `states`, `errors`, `forms`, `home`, `worklist`, `search`, `person`, `chronology`, `inbox`, `processes`, `asp`, `cp`, `marac`, `mappa`, `awi`, `meetings`, `actions`, `sharing`, `connectors`, `reports`, `audit`, `admin`, `settings`, `help`, `glossary`, `print`, `desktop`, `domain`. At most four levels deep. Keys sorted alphabetically within each object.
- Key names describe the place and purpose, never the text: `chronology.addEvent.submit`, not `chronology.saveEventButton`. Changing the wording never changes the key. camelCase segments, no abbreviations except the process codes.
- Style: British English, sentence case, no all-caps labels, no exclamation marks, no em dashes, no "Oops". `pnpm messages:check` fails the build if any appear.
- `en-GB.context.json` mirrors every key with `where` (one line on where the string appears), optional `maxLength`, `verbatim: true` where the wording is taken word for word from a published template (the MAPPA Annex 3 tables, the SafeLives return, the ASP NMDS indicators), and `screenshot` (a path under `docs/SCREENSHOTS/`). The Admin editor shows it and warns before a verbatim string is edited.

## Using it in code

```tsx
import { useT } from '@mas/messages';

function SaveButton({ count }: { count: number }) {
  const t = useT();
  return <Button>{t('actions.list.saveSelected', { count })}</Button>;
}
```

- `useT()` in components. `t()` from `@mas/messages` in code outside React (clocks, connectors, print packs, the desktop bridge). Both read the same merged messages, so an Admin override applies everywhere at once.
- `t.rich(key, { b: (chunks) => <strong>{chunks}</strong> })` for a message with tags.
- Keys are typed: `pnpm messages:types` regenerates `keys.generated.ts` from the JSON, so an unknown key or a missing argument is a compile error. Run it after editing the catalogue (`pnpm messages:merge` runs it for you).
- Dynamic keys: build the key from an enum value, `t(\`domain.agency.${agency}\`)`, through a typed helper such as `agencyLabel(agency)` in the domain package; the check script treats the template prefix as covering every key under it.
- Never put a date, time or number into a message. Format it and pass it in: `t('meetings.head.when', { date: formatDate(m.scheduledAt) })`.

## Editing copy

1. Open `packages/messages/src/en-GB.json`, find the key (the context file says where each one appears) and change the text. In `pnpm dev` the change hot-reloads; in a build it appears after `pnpm build`.
2. Or open Admin, Copy and labels: search for the text or key, edit inline, watch the preview, save. The change applies immediately, survives reload and is audited. Reset a key, or reset all, to return to the file's text. Export the overrides as JSON to move them to another machine; import merges them back.
3. Keep the wording rules: `pnpm messages:check` runs in `pnpm lint`.

## How overrides layer

Three layers merge in order, later winning:

1. The bundled catalogue, `en-GB.json`.
2. The local overrides file, `en-GB.local.json`, empty by default. A deployment that wants an area's wording without editing the catalogue writes only the keys it changes here.
3. Session overrides made in Admin. Only overridden keys are stored, never a full copy: in the browser under the localStorage key `mas.messages`, in the Tauri shell in the store plugin's `messages.json`, in the Electron shell in `message-overrides.json` in the app data directory. They survive reload and follow the same persistence as theme and density.

The old per-area label configuration (`config.labels`, the IRD label and its kin) is these keys with an override; there is one mechanism.

## Adding a locale

1. Copy `en-GB.json` to `<locale>.json` (for example `gd.json` for Gaelic) and translate the values. Keys, arguments, plural categories and tags stay the same; use the plural categories of the new language.
2. Copy `en-GB.context.json` alongside it, or share it, since context does not change with language.
3. Register the file in `packages/messages/src/catalogue.ts` and pick it by locale in the provider. No component changes: every string already goes through `t()`.
4. Adopting `next-intl` or `react-intl` later is a matter of pointing its provider at the JSON and replacing `useT()` with its hook (D-051).

## Scripts

| Command | What it does |
|---|---|
| `pnpm messages:types` | Regenerates `keys.generated.ts` (the `MessageKey` union and `MessageArgs` map) from the catalogue. |
| `pnpm messages:check` | Every message parses as ICU; every key is referenced; every referenced key exists; the context file covers every key; keys are sorted and no deeper than four; the style rules pass. Runs in `pnpm lint`. |
| `pnpm messages:extract` | Prints string literals a person could read that still sit in JSX, copy props, the domain, connectors and mock-data label maps, and the desktop shells. A clean run prints only the summary. Pass a path prefix to narrow it. |
| `pnpm messages:merge` | Folds `packages/messages/staging/<name>.messages.json` and `<name>.context.json` fragments into the catalogue and context file, sorted, and regenerates the types. |

## ESLint

`mas/no-hardcoded-copy` (in `tooling/eslint-config/rules/`) reports JSX text, copy-bearing props (`aria-label`, `title`, `placeholder`, `label`, `hint` and the rest) and string expressions in JSX that contain two or more letters. Punctuation, symbols, digits and whitespace are allowed. Each app lists the files the rule covers in its `eslint.config.js`; the list grows as namespaces migrate until it is a single wildcard.
