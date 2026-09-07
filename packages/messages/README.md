# @mas/messages

The message catalogue. Every string a person can see or hear in the platform lives in `src/en-GB.json` and nowhere else; `src/en-GB.context.json` tells an editor where each string appears. See `docs/MESSAGES.md` for the conventions, how to edit, how overrides layer and how to add a locale.

- `pnpm messages:types` regenerates `src/keys.generated.ts` from the catalogue.
- `pnpm messages:check` validates ICU syntax, key usage, context coverage and the style rules.
- `pnpm messages:extract` lists string literals that have not been moved yet.
- `pnpm messages:merge` folds `staging/*.json` fragments into the catalogue and context file, sorted.
