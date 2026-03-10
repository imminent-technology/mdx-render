import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildHtml } from '../src/template.js'

describe('buildHtml', () => {
  it('produces a valid HTML document', () => {
    const html = buildHtml({ title: 'My Doc', ssrHtml: '<p>Hello</p>', css: null, bundle: null })
    assert.ok(html.startsWith('<!DOCTYPE html>'))
    assert.ok(html.includes('<title>My Doc</title>'))
    assert.ok(html.includes('<p>Hello</p>'))
  })

  it('inlines a CSS block when provided', () => {
    const html = buildHtml({ title: 'Test', ssrHtml: '', css: 'body { color: red; }', bundle: null })
    assert.ok(html.includes('<style>'))
    assert.ok(html.includes('body { color: red; }'))
  })

  it('inlines a script block when bundle is provided', () => {
    const html = buildHtml({ title: 'Test', ssrHtml: '', css: null, bundle: 'console.log(1)' })
    assert.ok(html.includes('<script>console.log(1)</script>'))
  })

  it('omits <style> and <script> tags when css and bundle are null', () => {
    const html = buildHtml({ title: 'Test', ssrHtml: '<p>Hi</p>', css: null, bundle: null })
    assert.ok(!html.includes('<style>'))
    assert.ok(!html.includes('<script>'))
  })

  it('escapes special characters in the title', () => {
    const html = buildHtml({ title: '<script>alert(1)</script>', ssrHtml: '', css: null, bundle: null })
    assert.ok(!html.includes('<script>alert(1)</script>'))
    assert.ok(html.includes('&lt;script&gt;'))
  })

  it('places ssrHtml inside #root div', () => {
    const html = buildHtml({ title: 'T', ssrHtml: '<h1>Hi</h1>', css: null, bundle: null })
    assert.ok(html.includes('<div id="root"><h1>Hi</h1></div>'))
  })
})
