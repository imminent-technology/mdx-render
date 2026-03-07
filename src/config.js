import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Resolves the path to a components config file.
 *
 * If an explicit path is given, it returns the resolved absolute path (or null
 * if the file doesn't exist). If no path is given, auto-discovers
 * `mdx-render.config.js` in the current working directory.
 *
 * @param {string|undefined} explicitPath - Value of --config option (may be undefined)
 * @returns {Promise<string|null>} Absolute path to config file, or null if not found
 */
export async function resolveConfig(explicitPath) {
  if (explicitPath) {
    const abs = resolve(process.cwd(), explicitPath)
    return existsSync(abs) ? abs : null
  }

  // Auto-discover in cwd
  const defaultPath = resolve(process.cwd(), 'mdx-render.config.js')
  return existsSync(defaultPath) ? defaultPath : null
}

/**
 * Loads a resolved config file path and validates it exports a `components`
 * object. Throws a descriptive Error if the export is missing or malformed.
 *
 * Detection is done via static source analysis so JSX components files are
 * supported without needing to execute the config at validation time.
 *
 * @param {string} configPath - Absolute path to the config file
 */
export function validateConfig(configPath) {
  let source
  try {
    source = readFileSync(configPath, 'utf8')
  } catch (err) {
    throw new Error(`Could not read config file "${configPath}": ${err.message}`)
  }

  // Matches any standard named export of `components`:
  //   export const components = { … }
  //   export let components = { … }
  //   export { foo, components }
  //   export { Foo as components }
  const hasComponentsExport =
    /export\s+(const|let|var)\s+components\b/.test(source) ||
    /export\s*\{[^}]*\bcomponents\b[^}]*\}/.test(source)

  if (!hasComponentsExport) {
    throw new Error(
      `Config file "${configPath}" does not export \`components\`.\n` +
      `Expected: export const components = { MyComponent, \u2026 }`
    )
  }
}
