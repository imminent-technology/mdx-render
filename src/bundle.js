import * as esbuild from 'esbuild'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function resolveCliModule(specifier) {
  return require.resolve(specifier)
}

const BROWSER_ALIAS = () => ({
  react: resolveCliModule('react'),
  'react-dom': resolveCliModule('react-dom'),
  'react-dom/client': resolveCliModule('react-dom/client'),
  'react/jsx-runtime': resolveCliModule('react/jsx-runtime'),
  'react/jsx-dev-runtime': resolveCliModule('react/jsx-dev-runtime'),
})

const BROWSER_ESBUILD_OPTIONS = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: 'react',
  minify: true,
  write: false,
  loader: { '.js': 'jsx', '.jsx': 'jsx', '.mjs': 'js' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'silent',
}

/**
 * The browser-side companion to the server-side serializeNode.
 * Reconstructs React elements from the plain-JSON structures stored in
 * `data-props` attributes on island elements.
 */
const DESERIALIZE_HELPERS_ESM = `
import { createElement } from 'react';

function deserializeNode(node) {
  if (node == null) return null;
  if (typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(deserializeNode);
  if (node.$$el) return createElement(node.$$el, deserializeProps(node.props));
  if (node.$$html) return createElement('span', { dangerouslySetInnerHTML: { __html: node.$$html } });
  return null;
}

function deserializeProps(props) {
  if (!props) return {};
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = (k === 'children') ? deserializeNode(v) : v;
  }
  return out;
}
`

/**
 * Builds a minimal IIFE browser bundle that contains ONLY the config
 * components and a small hydration bootstrap. Static MDX content has no
 * corresponding JavaScript at all.
 *
 * Each `<div data-island="Name" data-props="...">` element in the HTML will
 * have React attached to it via `hydrateRoot`. Everything else is untouched
 * static HTML.
 *
 * @param {string} configPath      - Absolute path to mdx-render.config.js
 * @param {string[]} usedComponents - Component names actually used in the MDX
 * @param {string} inputPath       - Absolute path to the .mdx file
 * @returns {Promise<string|null>}  IIFE bundle string, or null if nothing to hydrate
 */
export async function bundleIslands(configPath, usedComponents, inputPath) {
  if (!configPath || usedComponents.length === 0) return null

  const tmpDir = mkdtempSync(join(tmpdir(), 'mdx-islands-'))

  try {
    const configImport = configPath.replace(/\\/g, '/')

    // The entry only imports config components and the hydration bootstrap.
    // The full MDX component tree is NOT included — it exists only as HTML in
    // the document.
    const entrySource = `
${DESERIALIZE_HELPERS_ESM}
import { components } from '${configImport}';
import { hydrateRoot } from 'react-dom/client';

document.querySelectorAll('[data-island]').forEach(function(el) {
  const name = el.dataset.island;
  const props = deserializeProps(JSON.parse(el.dataset.props || '{}'));
  const Component = components[name];
  if (Component) hydrateRoot(el, createElement(Component, props));
});
`
    const entryFile = join(tmpDir, 'islands-entry.js')
    writeFileSync(entryFile, entrySource, 'utf8')

    const nodePaths = [...new Set([
      join(dirname(configPath), 'node_modules'),
      join(dirname(inputPath), 'node_modules'),
    ])]

    const result = await esbuild.build({
      ...BROWSER_ESBUILD_OPTIONS,
      entryPoints: [entryFile],
      outdir: join(tmpDir, 'out'),
      alias: BROWSER_ALIAS(),
      nodePaths,
    })

    if (result.errors.length > 0) {
      const messages = await esbuild.formatMessages(result.errors, { kind: 'error' })
      throw new Error(messages.join('\n'))
    }

    return result.outputFiles[0].text
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * Full-page IIFE bundle for MDX files that import components directly.
 * This is the fallback path; the entire MDX component tree is included in
 * the bundle and `hydrateRoot` is called on the root element.
 *
 * @param {string} compiledJs  - ES module JS string from compileMdx()
 * @param {string} inputPath   - Absolute path to the original .mdx file
 * @param {string|null} configPath - Absolute path to mdx-render.config.js, or null
 * @returns {Promise<string>}  Minified IIFE bundle string
 */
export async function bundleForBrowser(compiledJs, inputPath, configPath) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mdx-render-'))

  try {
    const mdxContentFile = join(tmpDir, 'mdx-content.js')
    writeFileSync(mdxContentFile, compiledJs, 'utf8')

    const entryLines = [
      `import MDXContent from './mdx-content.js'`,
      `import { createElement } from 'react'`,
      `import { hydrateRoot } from 'react-dom/client'`,
    ]

    if (configPath) {
      const configImport = configPath.replace(/\\/g, '/')
      entryLines.push(`import { components } from '${configImport}'`)
      entryLines.push(
        `hydrateRoot(document.getElementById('root'), createElement(MDXContent, { components }))`
      )
    } else {
      entryLines.push(
        `hydrateRoot(document.getElementById('root'), createElement(MDXContent))`
      )
    }

    const entryFile = join(tmpDir, 'entry.js')
    writeFileSync(entryFile, entryLines.join('\n') + '\n', 'utf8')

    const nodePaths = [...new Set([
      ...(configPath ? [join(dirname(configPath), 'node_modules')] : []),
      join(dirname(inputPath), 'node_modules'),
    ])]

    const result = await esbuild.build({
      ...BROWSER_ESBUILD_OPTIONS,
      entryPoints: [entryFile],
      outdir: join(tmpDir, 'out'),
      alias: BROWSER_ALIAS(),
      nodePaths,
    })

    if (result.errors.length > 0) {
      const messages = await esbuild.formatMessages(result.errors, { kind: 'error' })
      throw new Error(messages.join('\n'))
    }

    return result.outputFiles[0].text
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}
