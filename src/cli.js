#!/usr/bin/env node

import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'fs'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
import { resolve, basename, extname } from 'path'
import { compileMdx } from './compile.js'
import { resolveConfig, validateConfig } from './config.js'
import { bundleIslands, bundleForBrowser } from './bundle.js'
import { serverRender } from './ssr.js'
import { buildHtml } from './template.js'

const program = new Command()

program
  .name('mdx-render')
  .description('Convert .mdx files to standalone HTML with embedded React components')
  .version(version)
  .argument('<input>', 'path to the .mdx file to convert')
  .option('-o, --output <file>', 'output HTML file path (defaults to <input-basename>.html)')
  .option('-c, --config <file>', 'path to components config file (defaults to mdx-render.config.js in cwd)')
  .option('--title <title>', 'HTML <title> tag content (defaults to filename without extension)')
  .option('--css <file>', 'path to a CSS file to inline into the output HTML')
  .action(async (input, options) => {
    const inputPath = resolve(process.cwd(), input)
    const outputPath = options.output
      ? resolve(process.cwd(), options.output)
      : resolve(process.cwd(), `${basename(input, extname(input))}.html`)

    const title = options.title ?? basename(input, extname(input))

    // Read .mdx source
    let mdxSource
    try {
      mdxSource = readFileSync(inputPath, 'utf8')
    } catch (err) {
      console.error(`Error: could not read input file "${inputPath}"`)
      console.error(err.message)
      process.exit(1)
    }

    // Optionally read CSS
    let css = null
    if (options.css) {
      const cssPath = resolve(process.cwd(), options.css)
      try {
        css = readFileSync(cssPath, 'utf8')
      } catch (err) {
        console.error(`Error: could not read CSS file "${cssPath}"`)
        console.error(err.message)
        process.exit(1)
      }
    }

    // Resolve components config
    const configPath = await resolveConfig(options.config)
    if (options.config && !configPath) {
      console.error(`Error: config file "${options.config}" not found`)
      process.exit(1)
    }
    if (configPath) {
      try {
        validateConfig(configPath)
      } catch (err) {
        console.error(`Error: ${err.message}`)
        process.exit(1)
      }
    }

    console.log(`Compiling ${input}...`)

    // 1. Compile MDX → JS module string
    let compiledJs
    try {
      compiledJs = await compileMdx(mdxSource)
    } catch (err) {
      console.error('Error: MDX compilation failed')
      console.error(err.message)
      process.exit(1)
    }

    // Detect whether the MDX file imported components directly (not via config).
    // Direct imports mean the compiled JS contains user-land import statements
    // beyond the standard react/jsx-runtime ones.
    const hasDirectImports = /^import .+ from ['"](?!react\/jsx-runtime|react\/jsx-dev-runtime)/m
      .test(compiledJs)

    // 2. Server-side render + choose bundling strategy:
    //
    //   a) Config provided & no direct MDX imports → Islands architecture:
    //      Each config component gets wrapped in a <div data-island> marker.
    //      The browser bundle contains ONLY the components + a tiny bootstrap.
    //      Static MDX content (headings, paragraphs, tables, …) has zero JS.
    //
    //   b) MDX has direct imports → Full bundle fallback:
    //      The entire MDX tree is bundled and hydrateRoot is called on #root.
    //      (Same behaviour as before; the imported components drive this path.)
    //
    //   c) Pure static MDX (no imports, no config) → No bundle at all.
    //      The SSR output is emitted as-is. No <script> tag in the HTML.

    let ssrResult, bundle

    // SSR: for islands we pass configPath so components get wrapped in
    // <div data-island> markers; for all other paths we pass null.
    const ssrConfigPath = (!hasDirectImports && configPath) ? configPath : null
    try {
      ssrResult = await serverRender(compiledJs, inputPath, ssrConfigPath)
    } catch (err) {
      console.error('Error: server-side rendering failed')
      console.error(err.message)
      process.exit(1)
    }

    if (!hasDirectImports && configPath) {
      // — Islands path: bundle only the config components + hydration bootstrap —
      try {
        bundle = await bundleIslands(configPath, ssrResult.usedComponents, inputPath)
      } catch (err) {
        console.error('Error: bundling failed')
        console.error(err.message)
        process.exit(1)
      }
    } else if (hasDirectImports) {
      // — Full bundle fallback: MDX has direct imports, hydrate the full tree —
      try {
        bundle = await bundleForBrowser(compiledJs, inputPath, configPath)
      } catch (err) {
        console.error('Error: bundling failed')
        console.error(err.message)
        process.exit(1)
      }
    } else {
      // — Pure static: no JS needed at all —
      bundle = null
    }

    // 3. Assemble HTML
    const html = buildHtml({ title, ssrHtml: ssrResult.html, css, bundle })

    // 4. Write output
    try {
      writeFileSync(outputPath, html, 'utf8')
    } catch (err) {
      console.error(`Error: could not write output file "${outputPath}"`)
      console.error(err.message)
      process.exit(1)
    }

    console.log(`Done → ${outputPath}`)
  })

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message)
  process.exit(1)
})
