/**
 * Props for the editor's text fields, which password managers would otherwise decorate with their
 * own buttons and offer to fill, e.g. 1Password on a field named "name". Each ignores
 * autocomplete="off" and looks for an attribute of its own.
 */
export const NO_AUTOFILL_PROPS = {
  autoComplete: 'off',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;
