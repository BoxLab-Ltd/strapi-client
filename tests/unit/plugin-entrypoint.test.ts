import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { existsSync, readFileSync } from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const repoRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
)
const pkg = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'),
) as {
    scripts: Record<string, string>
    exports: Record<string, Record<string, string>>
}

// Strapi loads a plugin with require() and reads the "strapi-server" export
// under the require condition, then dispatches on the file EXTENSION: .js is
// required, .json is parsed, anything else yields an empty plugin with no
// error. So the condition must exist, win over import, and end in .js.
describe('strapi-server export contract', () => {
    const entry = pkg.exports['./strapi-server']

    it('offers a require condition ahead of import', () => {
        const conditions = Object.keys(entry)
        expect(conditions).toContain('require')
        expect(conditions.indexOf('require')).toBeLessThan(
            conditions.indexOf('import'),
        )
    })

    it('points the require condition at a .js file', () => {
        expect(path.extname(entry.require)).toBe('.js')
    })

    it('builds that file — losing the step would ship a broken require path', () => {
        expect(pkg.scripts.build).toContain('tsconfig.cjs.json')
        expect(pkg.scripts.build).toContain('build-cjs.mjs')
    })
})

describe('built CommonJS entrypoint', () => {
    const target = pkg.exports['./strapi-server']?.require
    const entry = target ? path.join(repoRoot, target) : ''
    const built = entry !== '' && existsSync(entry)

    it.skipIf(!built)('loads under require and yields the whole plugin', () => {
        const require = createRequire(import.meta.url)
        const mod = require(entry)
        const plugin = typeof mod === 'function' ? mod({ env: () => {} }) : mod

        expect(Object.keys(plugin).sort()).toEqual([
            'bootstrap',
            'config',
            'controllers',
            'destroy',
            'register',
            'routes',
            'services',
        ])
        expect(plugin.routes['content-api'].routes.length).toBeGreaterThan(0)
        expect(Object.keys(plugin.services).sort()).toEqual([
            'endpoints',
            'schema',
        ])
    })

    it.skipIf(!built)('marks the subtree as CommonJS for Node', () => {
        const marker = JSON.parse(
            readFileSync(
                path.join(path.dirname(entry), 'package.json'),
                'utf-8',
            ),
        )
        expect(marker.type).toBe('commonjs')
    })
})
