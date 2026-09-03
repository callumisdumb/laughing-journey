import react from '@mas/eslint-config/react';
import { copyRule } from '@mas/eslint-config/copy';

/** Every component in the package renders its copy from the catalogue; the rule keeps it that way. */
export default [
  ...react,
  copyRule([
    'src/glyphs/Glyph.tsx',
    'src/glyphs/agencies.tsx',
    'src/glyphs/processes.tsx',
    'src/primitives/Button.tsx',
    'src/primitives/ClockNumeral.tsx',
    'src/primitives/DateField.tsx',
    'src/primitives/Dialog.tsx',
    'src/primitives/Field.tsx',
    'src/primitives/Marks.tsx',
    'src/primitives/Pill.tsx',
    'src/primitives/Sheet.tsx',
    'src/primitives/States.tsx',
    'src/primitives/Stepper.tsx',
    'src/primitives/Table.tsx',
    'src/primitives/Tabs.tsx',
    'src/primitives/Term.tsx',
    'src/primitives/Toast.tsx',
    'src/primitives/VoiceBlock.tsx',
  ]),
];
