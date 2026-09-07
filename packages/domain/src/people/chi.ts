/**
 * A synthetic CHI number, which is deliberately not a real one.
 *
 * The real Community Health Index number is ddmmyy plus a three digit serial, a ninth digit that is
 * odd for men and even for women, and a check digit computed with a modulus 11 weighting. This
 * builds the shape and skips the check digit rule, so every number this produces fails validation in
 * any system that actually checks one. That is the point: a number that looks right and validates
 * right is a number somebody eventually copies into a live system.
 *
 * The serial is supplied rather than drawn here, so a seeded generator and the create form can both
 * be deterministic without this function holding state.
 */
export function syntheticChi(dateOfBirth: string, sex: 'female' | 'male' | 'not-recorded', serial: number): string {
  const [year = '', month = '', day = ''] = dateOfBirth.split('-');
  const ninth = sex === 'male' ? [1, 3, 5, 7, 9][serial % 5] : [0, 2, 4, 6, 8][serial % 5];
  const pair = String(100 + (serial % 900)).slice(0, 2);
  return `${day}${month}${year.slice(2)}${pair}${ninth}${Math.floor(serial / 7) % 10}`;
}

/** True where a string has the shape this product stores CHI numbers in. Never a validity check. */
export function isSyntheticChiShape(value: string): boolean {
  return /^\d{10}$/.test(value);
}
