# mdx-render

Convert `.mdx` files to standalone HTML with embedded React components.

The output is a single self-contained `.html` file — no server required. Open it directly in a browser.

## Install

```bash
npm install -g mdx-render
```

## Usage

```bash
# Basic conversion — outputs my-doc.html
mdx-render my-doc.mdx

# Specify output file
mdx-render my-doc.mdx -o dist/index.html

# Add a custom page title
mdx-render my-doc.mdx --title "My Document"

# Inline a CSS file
mdx-render my-doc.mdx --css styles.css

# Use a components config (see below)
mdx-render my-doc.mdx --config mdx-render.config.js
```

### Options

| Option | Description |
|---|---|
| `<input>` | Path to the `.mdx` file to convert |
| `-o, --output <file>` | Output HTML file path (default: `<input-name>.html`) |
| `-c, --config <file>` | Path to components config (auto-discovers `mdx-render.config.js`) |
| `--title <title>` | HTML `<title>` tag content (default: input filename) |
| `--css <file>` | Path to a CSS file to inline into the output HTML |
| `-V, --version` | Print version number |
| `-h, --help` | Print help |

## Use with npx (no install required)

```bash
npx mdx-render my-doc.mdx
```

## Custom Components

MDX files can use custom React components. To make them available during bundling, create a config file:

```js
// mdx-render.config.js
import { MyChart } from './components/MyChart.jsx'
import { CodeBlock } from './components/CodeBlock.jsx'

export const components = {
  MyChart,
  CodeBlock,
}
```

Then run:

```bash
mdx-render my-doc.mdx --config mdx-render.config.js
```

Or place `mdx-render.config.js` in the same directory where you run the command — it will be picked up automatically.

Inside your `.mdx` file, use components by name:

```mdx
# Hello

<MyChart data={[1, 2, 3]} />

Some text with a <CodeBlock lang="js">console.log('hi')</CodeBlock>
```

> **Note:** The config file and its imports are bundled using esbuild. Your components' own dependencies must be installed in a `node_modules` directory reachable from the config file. React itself is provided by `mdx-render` — you do not need React in your project.

## How it works

1. The `.mdx` file is compiled to a JavaScript ES module using `@mdx-js/mdx`.
2. The compiled module is bundled with React (included), `react-dom/client`, and any custom components using `esbuild` into a single minified IIFE script.
3. The script is embedded in a minimal HTML file alongside a `<div id="root">`.
4. When the HTML file is opened in a browser, React mounts and renders the MDX content.

## License

MIT
