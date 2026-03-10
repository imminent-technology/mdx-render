import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compileMdx } from '../src/compile.js'

describe('compileMdx', () => {
  it('compiles plain markdown to a JS module string', async () => {
    const js = await compileMdx('# Hello')
    assert.ok(typeof js === 'string', 'result should be a string')
    assert.ok(js.includes('export default'), 'should export a default component')
  })

  it('compiles inline JSX expressions', async () => {
    const js = await compileMdx('The year is {new Date().getFullYear()}')
    assert.ok(js.includes('export default'))
  })

  it('compiles GFM tables via remark-gfm', async () => {
    const mdx = `
| A | B |
|---|---|
| 1 | 2 |
`
    const js = await compileMdx(mdx)
    assert.ok(js.includes('export default'))
    // The compiled output should reference table elements
    assert.ok(js.includes('table') || js.includes('thead') || js.includes('"tr"'))
  })

  it('throws on invalid MDX syntax', async () => {
    // Unclosed JSX tag is invalid
    await assert.rejects(
      () => compileMdx('<Foo'),
      (err) => {
        assert.ok(err instanceof Error)
        return true
      }
    )
  })
})
