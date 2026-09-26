import { describe, expect, it } from 'vitest';

import { serializeToString } from './XmlSerializer';

describe('serializeToString', () => {
  // Some browsers gave the exported documents' roots a namespace, and serializing them threw
  // "Cannot read properties of undefined (reading 'isRootNode')".
  it('serializes a namespaced root like any other', () => {
    const doc = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'g', null);
    doc.documentElement.appendChild(doc.createElementNS('http://www.w3.org/1999/xhtml', 'path'));
    expect(serializeToString(doc.documentElement, {})).toBe('<g><path/></g>');
  });

  it("doesn't write a namespace for roots without one", () => {
    const doc = document.implementation.createDocument(null, 'vector', null);
    expect(serializeToString(doc.documentElement, {})).toBe('<vector/>');
  });
});
