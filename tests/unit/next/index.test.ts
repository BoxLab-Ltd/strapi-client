import { describe, it, expect, afterEach } from 'vitest'
import * as path from 'path'
import { resolveOutputDir, withStrapiTypes } from '../../../src/next/index.js'

describe('resolveOutputDir (Next.js plugin)', () => {
    it('throws an actionable error when output is missing', () => {
        expect(() => resolveOutputDir({})).toThrow(
            /withStrapiTypes requires an `output`/,
        )
    })

    it('throws on empty / whitespace output', () => {
        expect(() => resolveOutputDir({ output: '' })).toThrow(
            /withStrapiTypes requires an `output`/,
        )
        expect(() => resolveOutputDir({ output: '   ' })).toThrow(
            /withStrapiTypes requires an `output`/,
        )
    })

    it('resolves a relative output against process.cwd()', () => {
        expect(resolveOutputDir({ output: './src/strapi' })).toBe(
            path.resolve(process.cwd(), './src/strapi'),
        )
    })

    it('trims a padded output before resolving', () => {
        expect(resolveOutputDir({ output: '  ./src/strapi  ' })).toBe(
            path.resolve(process.cwd(), './src/strapi'),
        )
    })
})

describe('withStrapiTypes gating', () => {
    const origEnv = process.env.NODE_ENV
    const origArgv = process.argv

    afterEach(() => {
        process.env.NODE_ENV = origEnv
        process.argv = origArgv
    })

    it('does not validate output outside dev/build (e.g. next start) and returns the config untouched', () => {
        // Neither development nor a `build` invocation → no generation, no
        // output requirement.
        process.env.NODE_ENV = 'production'
        process.argv = ['node', 'next', 'start']

        const nextConfig = { foo: 'bar' }
        expect(() => withStrapiTypes({})(nextConfig)).not.toThrow()
        expect(withStrapiTypes({})(nextConfig)).toBe(nextConfig)
    })

    it('throws synchronously in build mode when output is missing', () => {
        process.env.NODE_ENV = 'production'
        process.argv = ['node', 'next', 'build']

        expect(() => withStrapiTypes({})({})).toThrow(
            /withStrapiTypes requires an `output`/,
        )
    })
})
