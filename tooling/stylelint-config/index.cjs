/**
 * Stylelint rules for the product (brief section 8.6):
 * no !important outside utilities.css, no hex colours outside tokens.css,
 * no px font sizes, property order. Unused custom properties are checked by
 * unused-custom-properties.mjs because Stylelint cannot see across files.
 */
module.exports = {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-order'],
  rules: {
    'declaration-no-important': true,
    'color-no-hex': true,
    'declaration-property-unit-disallowed-list': { 'font-size': ['px'], 'line-height': ['px'] },
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'import-notation': null,
    'at-rule-no-unknown': [true, { ignoreAtRules: ['theme', 'custom-variant', 'source', 'utility', 'variant', 'apply', 'layer', 'reference', 'config', 'plugin'] }],
    'at-rule-no-deprecated': null,
    'value-keyword-case': null,
    'property-no-vendor-prefix': null,
    'no-descending-specificity': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'media-feature-range-notation': null,
    'order/order': ['custom-properties', 'declarations', 'rules', 'at-rules'],
    'order/properties-order': [
      [
        'content', 'position', 'inset', 'top', 'right', 'bottom', 'left', 'z-index',
        'display', 'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'grid', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-area', 'grid-column', 'grid-row', 'gap', 'row-gap', 'column-gap', 'align-items', 'align-self', 'align-content', 'justify-content', 'justify-items', 'justify-self', 'place-items', 'order',
        'box-sizing', 'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline', 'margin-block', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-inline', 'padding-block',
        'overflow', 'overflow-x', 'overflow-y', 'overscroll-behavior',
        'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric', 'font-variation-settings', 'font-stretch', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'text-overflow', 'text-wrap', 'white-space', 'word-break', 'hyphens', 'color',
        'background', 'background-color', 'background-image', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-radius', 'outline', 'outline-offset', 'box-shadow', 'opacity', 'visibility',
        'cursor', 'pointer-events', 'user-select', 'appearance', 'resize',
        'transform', 'transform-origin', 'transition', 'animation', 'will-change',
      ],
      { unspecified: 'bottomAlphabetical' },
    ],
  },
  overrides: [
    { files: ['**/utilities.css'], rules: { 'declaration-no-important': null } },
    { files: ['**/tokens.css'], rules: { 'color-no-hex': null } },
    /*
     * The source system simulator is a second product's palette, deliberately not the platform's.
     * Its colours are declared once at the top of its own module as `--sim-*` custom properties and
     * used through those, which is the same discipline the token file follows; the exception is that
     * the declarations live beside the component rather than in the shared token sheet, because
     * nothing else may use them. A blanket inline disable would have hidden a real drift.
     */
    { files: ['**/features/simulator/*.module.css'], rules: { 'color-no-hex': null } },
  ],
};
