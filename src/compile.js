import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'

/**
 * Compiles an MDX source string into a JavaScript ES module string.
 * The output exports `default` as the MDXContent React component.
 *
 * @param {string} mdxSource - Raw MDX source text
 * @returns {Promise<string>} Compiled JS module string
 */
export async function compileMdx(mdxSource) {
  const vfile = await compile(mdxSource, {
    jsxImportSource: 'react',
    outputFormat: 'program',
    remarkPlugins: [remarkGfm],
  })
  return String(vfile)
}
