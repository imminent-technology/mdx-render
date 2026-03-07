/**
 * Assembles the final standalone HTML document with server-rendered content.
 *
 * @param {object} options
 * @param {string} options.title    - HTML <title> content
 * @param {string} options.ssrHtml  - Pre-rendered inner HTML for the root div
 * @param {string|null} options.css - Inline CSS string, or null
 * @param {string|null} options.bundle - IIFE bundle script string, or null for static-only pages
 * @returns {string} Complete HTML document string
 */
export function buildHtml({ title, ssrHtml, css, bundle }) {
  const styleBlock = css
    ? `\n  <style>\n${css}\n  </style>`
    : ''

  // For purely static MDX (no interactive components) we emit no <script> tag
  // at all — the page is completely plain HTML with zero JavaScript.
  const scriptBlock = bundle
    ? `\n  <script>${bundle}</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>${styleBlock}
</head>
<body>
  <div id="root">${ssrHtml}</div>${scriptBlock}
</body>
</html>
`
}

/**
 * Escapes special HTML characters in a plain-text string for safe
 * inclusion in an HTML attribute or element text content.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
