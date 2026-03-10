import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync, mkdtempSync, rmSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveConfig, validateConfig } from '../src/config.js'

// ---------- resolveConfig ----------

describe('resolveConfig', () => {
  let dir

  before(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'mdx-render-test-')))
  })

  after(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns null when no explicit path given and no default config exists', async () => {
    // Use a temp dir that has no mdx-render.config.js; override cwd via process.chdir
    const original = process.cwd()
    process.chdir(dir)
    try {
      const result = await resolveConfig(undefined)
      assert.equal(result, null)
    } finally {
      process.chdir(original)
    }
  })

  it('returns the absolute path when an explicit existing file is given', async () => {
    const configFile = join(dir, 'my.config.js')
    writeFileSync(configFile, 'export const components = {}')
    const result = await resolveConfig(configFile)
    assert.equal(result, configFile)
  })

  it('returns null when an explicit path points to a non-existent file', async () => {
    const result = await resolveConfig(join(dir, 'does-not-exist.js'))
    assert.equal(result, null)
  })

  it('auto-discovers mdx-render.config.js in cwd', async () => {
    const defaultConfig = join(dir, 'mdx-render.config.js')
    writeFileSync(defaultConfig, 'export const components = {}')
    const original = process.cwd()
    process.chdir(dir)
    try {
      const result = await resolveConfig(undefined)
      assert.equal(result, defaultConfig)
    } finally {
      process.chdir(original)
      unlinkSync(defaultConfig)
    }
  })
})

// ---------- validateConfig ----------

describe('validateConfig', () => {
  let dir

  before(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'mdx-render-validate-')))
  })

  after(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not throw for a valid config with `export const components`', () => {
    const f = join(dir, 'valid1.js')
    writeFileSync(f, 'export const components = { Foo }')
    assert.doesNotThrow(() => validateConfig(f))
  })

  it('does not throw for a valid config with named re-export', () => {
    const f = join(dir, 'valid2.js')
    writeFileSync(f, 'const components = {}; export { components }')
    assert.doesNotThrow(() => validateConfig(f))
  })

  it('throws when `components` export is missing', () => {
    const f = join(dir, 'invalid.js')
    writeFileSync(f, 'export const myStuff = {}')
    assert.throws(() => validateConfig(f), /does not export `components`/)
  })

  it('throws when the config file does not exist', () => {
    assert.throws(() => validateConfig(join(dir, 'ghost.js')), /Could not read config file/)
  })
})
