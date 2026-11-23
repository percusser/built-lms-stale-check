const ALLOWED = new Set(['P', 'STRONG', 'EM', 'B', 'I', 'UL', 'OL', 'LI', 'BR']);

export function safeHtmlFragment(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const out = document.createDocumentFragment();
  const walk = (node, parent) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) parent.append(child.textContent);
      else if (child.nodeType === Node.ELEMENT_NODE) {
        if (ALLOWED.has(child.tagName)) {
          const el = document.createElement(child.tagName);
          parent.append(el);
          walk(child, el);
        } else walk(child, parent);
      }
    }
  };
  walk(doc.body.firstChild, out);
  return out;
}
