import react from '@mas/eslint-config/react';
import { copyRule } from '@mas/eslint-config/copy';

export default [...react, copyRule(['src/**/*.{ts,tsx}'])];
