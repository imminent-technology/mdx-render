import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const cli = resolve(root, 'src/cli.js')
const fixtures = resolve(root, 'fixtures')

function runCli(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
  })
}

describe('CLI integration', () => {
  it('prints version with --version', () => {
    const { stdout, status } = runCli(['--version'])
    const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    assert.equal(status, 0)
    assert.ok(stdout.includes(version))
  })

  it('prints help with --help', () => {
    const { stdout, status } = runCli(['--help'])
    assert.equal(status, 0)
    assert.ok(stdout.includes('mdx-render'))
    assert.ok(stdout.includes('--output'))
  })

  it('exits with error when input file does not exist', () => {
    const { stderr, status } = runCli(['nonexistent.mdx'])
    assert.notEqual(status, 0)
    assert.ok(stderr.includes('Error'))
  })

  it('converts basic.mdx to HTML', () => {
    const outFile = resolve(fixtures, 'basic.html')
    try {
      const { status, stderr } = runCli(
        [resolve(fixtures, 'basic.mdx'), '-o', outFile],
        fixtures
      )
      assert.equal(status, 0, `CLI failed: ${stderr}`)
      assert.ok(existsSync(outFile), 'output file should exist')
      const html = readFileSync(outFile, 'utf8')
      assert.ok(html.startsWith('<!DOCTYPE html>'))
      assert.ok(html.includes('<title>basic</title>'))
      assert.ok(html.includes('Hello from MDX'))
    } finally {
      if (existsSync(outFile)) unlinkSync(outFile)
    }
  })

  it('inlines a custom title', () => {
    const outFile = resolve(fixtures, 'titled.html')
    try {
      const { status, stderr } = runCli(
        [resolve(fixtures, 'basic.mdx'), '-o', outFile, '--title', 'My Custom Title'],
        fixtures
      )
      assert.equal(status, 0, `CLI failed: ${stderr}`)
      const html = readFileSync(outFile, 'utf8')
      assert.ok(html.includes('<title>My Custom Title</title>'))
    } finally {
      if (existsSync(outFile)) unlinkSync(outFile)
    }
  })

  it('converts with-components.mdx using a config file', () => {
    const outFile = resolve(fixtures, 'with-components.html')
    const configFile = resolve(fixtures, 'mdx-render.config.js')
    try {
      const { status, stderr } = runCli(
        [resolve(fixtures, 'with-components.mdx'), '-o', outFile, '--config', configFile],
        fixtures
      )
      assert.equal(status, 0, `CLI failed: ${stderr}`)
      assert.ok(existsSync(outFile))
      const html = readFileSync(outFile, 'utf8')
      assert.ok(html.includes('<!DOCTYPE html>'))
      assert.ok(html.includes('Interactive Components Demo'))
    } finally {
      if (existsSync(outFile)) unlinkSync(outFile)
    }
  })

  it('exits with error when --config points to a missing file', () => {
    const { stderr, status } = runCli([
      resolve(fixtures, 'basic.mdx'),
      '--config',
      'does-not-exist.js',
    ])
    assert.notEqual(status, 0)
    assert.ok(stderr.includes('Error'))
  })
})
