import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as ts from 'typescript'
import { Generator } from '../../../src/generator/index.js'
import type { ParsedSchema } from '../../../src/schema-types.js'

const mockSchema: ParsedSchema = {
    contentTypes: [
        {
            name: 'ApiItemItem',
            cleanName: 'Item',
            collectionName: 'items',
            singularName: 'item',
            pluralName: 'items',
            kind: 'collection',
            attributes: [
                { name: 'title', type: { kind: 'string' }, required: true },
            ],
            relations: [],
            media: [],
            components: [],
            dynamicZones: [],
        },
    ],
    components: [],
}

function relativeImportSpecifiers(filePath: string): string[] {
    const source = fs.readFileSync(filePath, 'utf-8')
    const sf = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.ES2022,
        true,
    )
    const specs: string[] = []
    sf.forEachChild(node => {
        const decl =
            ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
                ? node
                : null
        if (
            decl?.moduleSpecifier &&
            ts.isStringLiteral(decl.moduleSpecifier) &&
            decl.moduleSpecifier.text.startsWith('.')
        ) {
            specs.push(decl.moduleSpecifier.text)
        }
    })
    return specs
}

describe("Generator with format: 'ts'", () => {
    let tmpDir: string

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-ts-'))
        await new Generator(tmpDir).generate(
            mockSchema,
            undefined,
            undefined,
            '',
            '',
            'ts',
        )
    })

    afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

    it('emits source files for the consumer to compile', () => {
        expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, 'index.js'))).toBe(false)
    })

    // tsc under moduleResolution "bundler" resolves .js → .ts, but stricter
    // bundlers (Turbopack / Next 16) don't, breaking `next build` for
    // monorepo consumers — see issue #35.
    it('uses extensionless specifiers for local imports', () => {
        const allSpecs = [
            ...relativeImportSpecifiers(path.join(tmpDir, 'index.ts')),
            ...relativeImportSpecifiers(path.join(tmpDir, 'client.ts')),
            ...relativeImportSpecifiers(path.join(tmpDir, 'types.ts')),
        ]

        expect(allSpecs.length).toBeGreaterThan(0)
        for (const spec of allSpecs) {
            expect(spec).not.toMatch(/\.js$/)
        }
    })
})

describe("Generator with format: 'js'", () => {
    let tmpDir: string

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-js-'))
        await new Generator(tmpDir).generate(
            mockSchema,
            undefined,
            undefined,
            '',
            '',
            'js',
        )
    })

    afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

    it('emits compiled JavaScript with declaration files', () => {
        expect(fs.existsSync(path.join(tmpDir, 'index.js'))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, 'client.js'))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, 'index.d.ts'))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(false)
    })

    // Node ESM resolution requires explicit extensions on relative imports;
    // the .ts → ts compile step must preserve them in the emitted .js.
    it('preserves .js extensions on local imports', () => {
        const indexSpecs = relativeImportSpecifiers(
            path.join(tmpDir, 'index.js'),
        )
        const clientSpecs = relativeImportSpecifiers(
            path.join(tmpDir, 'client.js'),
        )

        expect([...indexSpecs, ...clientSpecs].length).toBeGreaterThan(0)
        for (const spec of [...indexSpecs, ...clientSpecs]) {
            expect(spec).toMatch(/\.js$/)
        }
    })
})
