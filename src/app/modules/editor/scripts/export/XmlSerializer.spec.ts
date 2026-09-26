import { describe, expect, it } from 'vitest';

import { serializeToString } from './XmlSerializer';

describe('serializeToString', () => {
  // Some browsers gave the exported documents' roots a namespace, and serializing them threw
  // "Cannot read properties of undefined (reading 'isRootNode')".
  it('writes the namespace of a namespaced root', () => {
    const doc = document.implementation.createDocument('http://www.w3.org/2000/svg', 'svg', null);
    doc.documentElement.appendChild(doc.createElementNS('http://www.w3.org/2000/svg', 'g'));
    expect(serializeToString(doc.documentElement, {})).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>',
    );
  });

  it("doesn't write a namespace for roots without one", () => {
    const doc = document.implementation.createDocument(null, 'vector', null);
    expect(serializeToString(doc.documentElement, {})).toBe('<vector/>');
  });
});
