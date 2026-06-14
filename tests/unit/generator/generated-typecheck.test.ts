import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as ts from 'typescript'
import { Generator } from '../../../src/generator/index.js'
import type { ParsedSchema, ContentType } from '../../../src/schema-types.js'
import type { ParsedEndpoint } from '../../../src/shared/endpoint-types.js'
import { mockSchema } from './fixtures/mock-schema.js'

/**
 * Type-clean guarantee: the generated `--format ts` client must compile under
 * strict mode WITHOUT its `@ts-nocheck` header. This is the test-suite mirror
 * of the fail-on-diagnostic guard in `Generator.compileFiles`, and guards the
 * v2.0 type-clean wave: private endpoint, fetchOptions.next, QueryParams cast,
 * the TPopulate / GetPayload overload constraint ("Bug B"), and the
 * custom-route CRUD-name collision ("Bug D").
 *
 * It runs against the rich shared fixture (components, dynamic zones, single
 * types, single + multiple media, relations of several cardinalities) plus an
 * extra content type exercising enums, oneToOne / manyToMany, blocks and json,
 * so a broad slice of generated shapes is covered — not just content types.
 *
 * The appended assertion module also pins the behaviour the fixes preserve:
 * populate narrowing still works, invalid populate keys are still rejected
 * (via `@ts-expect-error`, which fails the build if unused), and a custom route
 * reusing `create` is mangled (`createItem`) rather than shadowing the base.
 */

// Extra content type covering shapes the shared fixture doesn't: an enum, a
// oneToOne and a manyToMany relation, blocks/json scalars, and multi-media.
const widget: ContentType = {
    name: 'ApiWidgetWidget',
    cleanName: 'Widget',
    collectionName: 'widgets',
    singularName: 'widget',
    pluralName: 'widgets',
    kind: 'collection',
    attributes: [
        {
            name: 'status',
            type: { kind: 'enumeration', values: ['draft', 'published'] },
            required: false,
        },
        { name: 'body', type: { kind: 'blocks' }, required: false },
        { name: 'meta', type: { kind: 'json' }, required: false },
        { name: 'when', type: { kind: 'datetime' }, required: false },
    ],
    relations: [
        {
            name: 'primaryCategory',
            relationType: 'oneToOne',
            target: 'api::category.category',
            targetType: 'Category',
            required: false,
        },
        {
            name: 'relatedItems',
            relationType: 'manyToMany',
            target: 'api::item.item',
            targetType: 'Item',
            required: false,
        },
    ],
    media: [{ name: 'gallery', multiple: true, required: false }],
    components: [],
    dynamicZones: [],
}

const schema: ParsedSchema = {
    contentTypes: [...mockSchema.contentTypes, widget],
    components: mockSchema.components,
}

// A custom route that reuses the `create` CRUD action on the item controller.
const endpoints: ParsedEndpoint[] = [
    {
        method: 'POST',
        path: '/items/special',
        handler: 'api::item.item.create',
        controller: 'item',
        action: 'create',
    },
]

// Exercises populate narrowing, invalid-key rejection, and the Bug D mangle
// against the generated client.
const ASSERTIONS = `import { StrapiClient } from './client'
declare const client: StrapiClient
async function _assert() {
  // populate narrowing preserved: the populated relation key is present
  const a = await client.items.find({ populate: { category: true } })
  type ElA = (typeof a)[number]
  const _cat: ElA['category'] = null as any
  void _cat
  // @ts-expect-error - an invalid populate key must be rejected
  await client.items.find({ populate: { notAKey: true } })
  await client.items.find({ populate: '*' })
  await client.items.find({ populate: true })
  // without populate the relation key is absent from the base result
  const b = await client.items.find()
  type ElB = (typeof b)[number]
  // @ts-expect-error - relations are absent without populate
  const _noCat: ElB['category'] = null as any
  void _noCat
  // Bug D: the inherited base create stays typed, and the custom route that
  // reused the \`create\` action is exposed under the mangled name.
  await client.items.create({ title: 'x' })
  await client.items.createItem()
}
void _assert
`

describe('generated client type-checks clean without @ts-nocheck', () => {
    let tmpDir: string
    let diagnostics: ts.Diagnostic[]
    let clientSource: string

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-tc-'))
        await new Generator(tmpDir).generate(
            schema,
            endpoints,
            undefined,
            '',
            '',
            'ts',
        )
        clientSource = fs.readFileSync(path.join(tmpDir, 'client.ts'), 'utf-8')

        const files = ['types.ts', 'client.ts', 'index.ts'].map(f =>
            path.join(tmpDir, f),
        )
        // strip the `/* eslint-disable */` header so tsc actually checks
        for (const f of files) {
            const src = fs
                .readFileSync(f, 'utf-8')
                .replace(/^\/\* eslint-disable \*\/\n?/m, '')
            fs.writeFileSync(f, src)
        }

        const assertPath = path.join(tmpDir, '__assert.ts')
        fs.writeFileSync(assertPath, ASSERTIONS)
        files.push(assertPath)

        const program = ts.createProgram(files, {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            strict: true,
            skipLibCheck: true,
            noEmit: true,
        })
        diagnostics = [...ts.getPreEmitDiagnostics(program)]
    })

    afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

    it('produces zero type errors (and preserves populate narrowing + key rejection)', () => {
        const formatted = diagnostics.map(d => {
            const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ')
            let loc = ''
            if (d.file && d.start !== undefined) {
                const { line } = d.file.getLineAndCharacterOfPosition(d.start)
                loc = `${path.basename(d.file.fileName)}:${line + 1} `
            }
            return `TS${d.code} ${loc}${msg}`
        })
        expect(formatted).toEqual([])
    })

    it('name-mangles a custom route that reuses a base CRUD action (Bug D)', () => {
        expect(clientSource).toContain('async createItem(')
        const itemApi =
            clientSource.match(/class ItemAPI extends[\s\S]*?\n}/)?.[0] ?? ''
        expect(itemApi).toContain('async createItem(')
        // the inherited base `create` must NOT be overridden by the custom route
        expect(itemApi).not.toContain('async create(')
    })
})
