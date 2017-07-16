export function serializeToString(node, options): string {
  options = options || {};
  options.rootNode = true;
  return removeInvalidCharacters(nodeTreeToXHTML(node, options));
}

function removeInvalidCharacters(content: string) {
  // See http://www.w3.org/TR/xml/#NT-Char for valid XML 1.0 characters.
  return content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function serializeAttributeValue(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function serializeTextContent(content: string) {
  return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serializeAttribute(attr) {
  const value = attr.value;
  return attr.name + '="' + serializeAttributeValue(value) + '"';
}

function getTagName(node: Element) {
  let tagName = node.tagName;

  // Aid in serializing of original HTML documents.
  if (node.namespaceURI === 'http://www.w3.org/1999/xhtml') {
    tagName = tagName.toLowerCase();
  }
  return tagName;
}

function serializeNamespace(node, options) {
  const nodeHasXmlnsAttr =
    Array.prototype.map
      .call(node.attributes || node.attrs, attr => {
        return attr.name;
      })
      .indexOf('xmlns') >= 0;

  // Serialize the namespace as an xmlns attribute whenever the element
  // doesn't already have one and the inherited namespace does not match
  // the element's namespace.
  if (
    !nodeHasXmlnsAttr &&
    node.namespaceURI &&
    options.isRootNode /* ||
         node.namespaceURI !== node.parentNode.namespaceURI*/
  ) {
    return ' xmlns="' + node.namespaceURI + '"';
  }
  return '';
}

function serializeChildren(node: Element, options) {
  return Array.prototype.map
    .call(node.childNodes, childNode => {
      return nodeTreeToXHTML(childNode, options);
    })
    .join('');
}

function serializeTag(node, options) {
  let output = '';
  if (options.indent && options._indentLevel) {
    output += Array(options._indentLevel * options.indent + 1).join(' ');
  }
  output += '<' + getTagName(node);
  output += serializeNamespace(node, options.isRootNode);

  const attributes = node.attributes || node.attrs;
  Array.prototype.forEach.call(attributes, attr => {
    if (options.multiAttributeIndent && attributes.length > 1) {
      output += '\n';
      output += Array(
        (options._indentLevel || 0) * options.indent + options.multiAttributeIndent + 1,
      ).join(' ');
    } else {
      output += ' ';
    }
    output += serializeAttribute(attr);
  });

  if (node.childNodes.length > 0) {
    output += '>';
    if (options.indent) {
      output += '\n';
    }
    options.isRootNode = false;
    options._indentLevel = (options._indentLevel || 0) + 1;
    output += serializeChildren(node, options);
    --options._indentLevel;
    if (options.indent && options._indentLevel) {
      output += Array(options._indentLevel * options.indent + 1).join(' ');
    }
    output += '</' + getTagName(node) + '>';
  } else {
    output += '/>';
  }
  if (options.indent) {
    output += '\n';
  }
  return output;
}

function serializeText(node) {
  const text = node.nodeValue || node.value || '';
  return serializeTextContent(text);
}

function serializeComment(node) {
  return '<!--' + node.data.replace(/-/g, '&#45;') + '-->';
}

function serializeCDATA(node: Element) {
  return '<![CDATA[' + node.nodeValue + ']]>';
}

function nodeTreeToXHTML(node: Element, options) {
  if (node.nodeName === '#document' || node.nodeName === '#document-fragment') {
    return serializeChildren(node, options);
  } else {
    if (node.tagName) {
      return serializeTag(node, options);
    } else if (node.nodeName === '#text') {
      return serializeText(node);
    } else if (node.nodeName === '#comment') {
      return serializeComment(node);
    } else if (node.nodeName === '#cdata-section') {
      return serializeCDATA(node);
    }
  }
}
