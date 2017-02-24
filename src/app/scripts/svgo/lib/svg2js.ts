import * as SAX from 'sax';
import { JSAPI } from './jsAPI';

const entityDeclaration = /<!ENTITY\s+(\S+)\s+(?:'([^\']+)'|"([^\"]+)")\s*>/g;

const config = {
  strict: true,
  trim: false,
  normalize: true,
  lowercase: true,
  xmlns: true,
  position: true
};

/**
 * Convert SVG (XML) string to SVG-as-JS object.
 *
 * @param {String} data input data
 * @param {Function} callback
 */
export function svgToJs(data, callback) {
  const sax = SAX.parser(config.strict, config);
  const root = new (JSAPI as any)({ elem: '#document' });
  let current = root;
  const stack = [root];
  let textContext = null;
  let parsingError = false;

  function pushToContent(content) {
    content = new (JSAPI as any)(content, current);
    (current.content = current.content || []).push(content);
    return content;
  }

  sax.ondoctype = function (doctype) {
    pushToContent({
      doctype: doctype
    });
    const subsetStart = doctype.indexOf('[');
    let entityMatch;
    if (subsetStart >= 0) {
      entityDeclaration.lastIndex = subsetStart;
      while ((entityMatch = entityDeclaration.exec(data)) != null) {
        sax.ENTITIES[entityMatch[1]] = entityMatch[2] || entityMatch[3];
      }
    }
  };

  sax.onprocessinginstruction = function (d) {
    pushToContent({
      processinginstruction: d
    });
  };

  sax.oncomment = function (comment) {
    pushToContent({
      comment: comment.trim()
    });
  };

  sax.oncdata = function (cdata) {
    pushToContent({
      cdata: cdata
    });
  };

  sax.onopentag = function (d) {
    let elem: any = {
      elem: d.name,
      prefix: d.prefix,
      local: d.local
    };

    if (Object.keys(d.attributes).length) {
      elem.attrs = {};

      for (const name in d.attributes) {
        if (!d.attributes.hasOwnProperty(name)) {
          continue;
        }
        elem.attrs[name] = {
          name,
          value: d.attributes[name].value,
          prefix: d.attributes[name].prefix,
          local: d.attributes[name].local
        };
      }
    }

    elem = pushToContent(elem);
    current = elem;

    // Save info about <text> tag to prevent trimming of meaningful whitespace
    if (d.name === 'text' && !d.prefix) {
      textContext = current;
    }
    stack.push(elem);
  };

  sax.ontext = function (text) {
    if (/\S/.test(text) || textContext) {
      if (!textContext) {
        text = text.trim();
      }
      pushToContent({ text });
    }
  };

  sax.onclosetag = function () {
    const last = stack.pop();

    // Trim text inside <text> tag.
    if (last === textContext) {
      trim(textContext);
      textContext = null;
    }
    current = stack[stack.length - 1];
  };

  sax.onerror = function (e) {
    e.message = 'Error in parsing SVG: ' + e.message;
    if (e.message.indexOf('Unexpected end') < 0) {
      throw e;
    }
  };

  sax.onend = function () {
    if (!this.error) {
      callback(root);
    } else {
      callback({ error: this.error.message });
    }
  };

  try {
    sax.write(data);
  } catch (e) {
    callback({ error: e.message });
    parsingError = true;
  }
  if (!parsingError) {
    sax.close();
  }

  function trim(elem) {
    if (!elem.content) {
      return elem;
    }
    let start = elem.content[0];
    let end = elem.content[elem.content.length - 1];

    while (start && start.content && !start.text) {
      start = start.content[0];
    }
    if (start && start.text) {
      start.text = start.text.replace(/^\s+/, '');
    }
    while (end && end.content && !end.text) {
      end = end.content[end.content.length - 1];
    }
    if (end && end.text) {
      end.text = end.text.replace(/\s+$/, '');
    }
    return elem;
  }
};
