const ALLOWED = new Set(['p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

export function toPlainText(html) {
  return String(html)
    .replace(/<(script|style|iframe|object|template)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeHtml(html) {
  return String(html)
    .replace(/<(script|style|iframe|object|template)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (tag, name) => {
      const n = name.toLowerCase();
      if (!ALLOWED.has(n)) return '';
      return tag.startsWith('</') ? `</${n}>` : n === 'br' ? '<br>' : `<${n}>`;
    })
    .replace(/<(?![/a-z])/gi, '&lt;');
}
