import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as ts from 'typescript'
import { Generator } from '../../../src/generator/index.js'
import type {
    ParsedSchema,
    ContentType,
    Component,
} from '../../../src/schema-types.js'
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

// A component nesting another component — the shared fixture only has flat
// ones, and component filters must recurse (#73).
const projectMeta: Component = {
    name: 'ProjectMeta',
    cleanName: 'ProjectMeta',
    category: 'project',
    uid: 'project.meta',
    attributes: [{ name: 'slug', type: { kind: 'string' }, required: false }],
    relations: [],
    media: [],
    components: [
        {
            name: 'config',
            component: 'project.project-config',
            componentType: 'ProjectConfig',
            repeatable: false,
            required: false,
        },
    ],
    dynamicZones: [],
}

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
    components: [
        {
            name: 'details',
            component: 'project.meta',
            componentType: 'ProjectMeta',
            repeatable: false,
            required: false,
        },
    ],
    dynamicZones: [],
}

// A single type whose name camelCases to `auth`, colliding with the
// users-permissions `auth` namespace unless the content-type property is
// disambiguated (regression guard for the auth-property collision).
const authSingle: ContentType = {
    name: 'ApiAuthAuth',
    cleanName: 'Auth',
    collectionName: 'auths',
    singularName: 'auth',
    pluralName: 'auths',
    kind: 'single',
    attributes: [
        { name: 'provider', type: { kind: 'string' }, required: false },
    ],
    relations: [],
    media: [],
    components: [],
    dynamicZones: [],
}

const schema: ParsedSchema = {
    contentTypes: [...mockSchema.contentTypes, widget, authSingle],
    components: [...mockSchema.components, projectMeta],
}

// Custom routes that exercise: (1) reusing the `create` CRUD action on item
// (Bug D mangle), and (2) a response referencing a type that isn't generated
// or known — it must degrade to `unknown` instead of emitting an undefined name.
const endpoints: ParsedEndpoint[] = [
    {
        method: 'POST',
        path: '/items/special',
        handler: 'api::item.item.create',
        controller: 'item',
        action: 'create',
    },
    {
        method: 'GET',
        path: '/items/active-generation',
        handler: 'api::item.item.getActiveGeneration',
        controller: 'item',
        action: 'getActiveGeneration',
        types: { response: 'GenerationView | null' },
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
  // @ts-expect-error - create requires the required scalar \`title\`
  await client.items.create({})
  // update is partial — an empty object is fine
  await client.items.update('id', {})
  await client.items.createItem()
  // component fields are filterable, including through a nested component
  await client.widgets.find({ filters: { details: { slug: { $eq: 'x' } } } })
  await client.widgets.find({ filters: { details: { config: { key: { $contains: 'k' } } } } })
  // repeatable components filter with the single-component shape
  await client.projects.find({ filters: { config: { key: { $eq: 'k' } } } })
  // @ts-expect-error - a component filter still type-checks its values
  await client.widgets.find({ filters: { details: { slug: { $eq: 123 } } } })
  // @ts-expect-error - an unknown key inside a component filter is rejected
  await client.widgets.find({ filters: { details: { notAKey: { $eq: 'x' } } } })
  // @ts-expect-error - dynamic zones are polymorphic; Strapi cannot filter them
  await client.projects.find({ filters: { sections: { title: { $eq: 'x' } } } })
  // the system timestamps Strapi adds to every document are filterable
  await client.items.find({ filters: { publishedAt: { $notNull: true }, createdAt: { $gte: '2026-01-01' } } })
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
            noUncheckedIndexedAccess: true,
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

    it('reserves `auth` for the users-permissions namespace and disambiguates a colliding content type', () => {
        expect(clientSource).toContain('auth: AuthAPI')
        // the single type `auth` must not clobber the namespace
        expect(clientSource).toContain('authSingle:')
        expect(clientSource).toContain('this.authSingle = new SingleTypeAPI(')
    })

    it('degrades an unresolved custom-endpoint type to `unknown` (not an undefined name)', () => {
        // the response `GenerationView | null` becomes `unknown | null`
        expect(clientSource).toContain('GetActiveGenerationResponse = unknown')
        // ...with a discoverable note naming what was dropped
        expect(clientSource).toContain('could not be resolved')
    })
})
