import * as esbuild from 'esbuild'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { createRequire } from 'module'
import { spawnSync } from 'child_process'

const require = createRequire(import.meta.url)

/**
 * Serialize a React element tree into a plain-JSON structure so it can be
 * stored in a `data-props` attribute and reconstructed in the browser.
 *
 * - Primitives pass through as-is.
 * - Native HTML element nodes are stored as { $$el, props } and recursed.
 * - Custom component nodes are rendered to an HTML string as { $$html }.
 */
const SERIALIZE_HELPERS_CJS = `
const { isValidElement, createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function serializeNode(node) {
  if (node == null) return null;
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(serializeNode);
  if (isValidElement(node)) {
    if (typeof node.type === 'string') {
      const props = {};
      for (const [k, v] of Object.entries(node.props || {})) {
        if (k === 'key' || k === 'ref') continue;
        if (k === 'children') { props.children = serializeNode(v); continue; }
        if (k === 'style' && v && typeof v === 'object') { props.style = v; continue; }
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') props[k] = v;
      }
      return { $$el: node.type, props };
    }
    try { return { $$html: renderToStaticMarkup(node) }; }
    catch { return null; }
  }
  return null;
}

function serializeProps(props) {
  const out = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'key' || k === 'ref') continue;
    if (k === 'children') { out.children = serializeNode(v); continue; }
    if (k === 'style' && v && typeof v === 'object') { out.style = v; continue; }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}
`

/**
 * Generates the CJS entry source for an island-aware SSR run.
 *
 * Each config component is wrapped so it emits a `<div data-island="Name"
 * data-props="...">` element around its rendered output. The MDX is then
 * rendered with these wrapped components so only the island elements carry
 * data attributes; all static HTML between them is plain DOM.
 *
 * Outputs { html, usedComponents } to stdout as JSON.
 */
function buildIslandSsrEntry(configPath) {
  const configImport = configPath.replace(/\\/g, '/')
  return `
${SERIALIZE_HELPERS_CJS}
const { renderToString } = require('react-dom/server');
const MDXContent = require('./mdx-content.js').default;
const { components: configComponents } = require('${configImport}');

const usedComponents = new Set();
const islandComponents = {};
for (const [name, Component] of Object.entries(configComponents)) {
  islandComponents[name] = function IslandWrapper(props) {
    usedComponents.add(name);
    const serializedProps = serializeProps(props);
    return createElement(
      'div',
      { 'data-island': name, 'data-props': JSON.stringify(serializedProps) },
      createElement(Component, props)
    );
  };
}

const html = renderToString(createElement(MDXContent, { components: islandComponents }));
process.stdout.write(JSON.stringify({ html, usedComponents: [...usedComponents] }));
`
}

/**
 * Generates the CJS entry source for a plain SSR run (no island wrappers).
 * Outputs { html, usedComponents: [] } to stdout as JSON.
 */
function buildPlainSsrEntry() {
  return `
const { createElement } = require('react');
const { renderToString } = require('react-dom/server');
const MDXContent = require('./mdx-content.js').default;

const html = renderToString(createElement(MDXContent));
process.stdout.write(JSON.stringify({ html, usedComponents: [] }));
`
}

const SHARED_ESBUILD_OPTIONS = {
  bundle: true,
  // CJS is required: react-dom/server internally calls require('util') etc.
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  jsxImportSource: 'react',
  write: true,
  loader: { '.js': 'jsx', '.jsx': 'jsx', '.mjs': 'js' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'silent',
}

/**
 * Server-side renders the compiled MDX.
 *
 * When `configPath` is provided, each config component is wrapped in an island
 * marker (`<div data-island="Name" data-props="...">`) so the browser only
 * needs to hydrate those specific elements — all static HTML requires no JS.
 *
 * @param {string} compiledJs  - ES module JS string from compileMdx()
 * @param {string} inputPath   - Absolute path to the original .mdx file
 * @param {string|null} configPath - Absolute path to mdx-render.config.js, or null
 * @returns {Promise<{ html: string, usedComponents: string[] }>}
 */
export async function serverRender(compiledJs, inputPath, configPath) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mdx-ssr-'))

  try {
    const mdxContentFile = join(tmpDir, 'mdx-content.js')
    writeFileSync(mdxContentFile, compiledJs, 'utf8')

    const entrySource = configPath
      ? buildIslandSsrEntry(configPath)
      : buildPlainSsrEntry()

    const entryFile = join(tmpDir, 'ssr-entry.js')
    writeFileSync(entryFile, entrySource, 'utf8')

    const nodePaths = [...new Set([
      ...(configPath ? [join(dirname(configPath), 'node_modules')] : []),
      join(dirname(inputPath), 'node_modules'),
    ])]

    const outFile = join(tmpDir, 'ssr-bundle.cjs')

    await esbuild.build({
      ...SHARED_ESBUILD_OPTIONS,
      entryPoints: [entryFile],
      outfile: outFile,
      alias: {
        react: require.resolve('react'),
        'react-dom': require.resolve('react-dom'),
        'react-dom/server': require.resolve('react-dom/server'),
        'react/jsx-runtime': require.resolve('react/jsx-runtime'),
        'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
      },
      nodePaths,
    })

    const result = spawnSync(process.execPath, [outFile], {
      encoding: 'utf8',
      timeout: 30000,
    })

    if (result.error) throw result.error
    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || 'SSR execution failed')
    }

    return JSON.parse(result.stdout)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}
