import noHardcodedCopy from './rules/no-hardcoded-copy.js';

/** The local plugin carrying the copy rule. */
export const masPlugin = { rules: { 'no-hardcoded-copy': noHardcodedCopy } };

/**
 * Turn the copy rule on for a set of globs. Migrated directories are listed by the app; once every
 * namespace has moved the list is a single wildcard.
 */
export function copyRule(files, allowedStrings = []) {
  return {
    files,
    plugins: { mas: masPlugin },
    rules: { 'mas/no-hardcoded-copy': ['error', { allowedStrings }] },
  };
}
