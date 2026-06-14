import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as ts from 'typescript'
import { Generator } from '../../../src/generator/index.js'
import type { ParsedSchema } from '../../../src/schema-types.js'

/**
 * Type-clean guarantee: the generated `--format ts` client must compile under
 * strict mode WITHOUT its `@ts-nocheck` header. This guards the bugs cleared in
 * the v2.0 type-clean wave (private endpoint, fetchOptions.next, QueryParams
 * cast, and the TPopulate / GetPayload overload constraint — "Bug B").
 *
 * The appended assertion module also pins the *behaviour* the Bug B fix had to
 * preserve: populate narrowing still works and invalid populate keys are still
 * rejected (encoded as `@ts-expect-error`, which fails the build if unused).
 *
 * Note: this schema has no custom routes, so "Bug D" is out of scope here.
 */

const rel = (name: string, target: string, targetType: string) => ({
    name,
    type: 'manyToOne' as const,
    target,
    targetType,
    targetName: targetType,
    isArray: false,
})

const schema: ParsedSchema = {
    contentTypes: [
        {
            name: 'ApiArticleArticle',
            cleanName: 'Article',
            collectionName: 'articles',
            singularName: 'article',
            pluralName: 'articles',
            kind: 'collection',
            attributes: [
                { name: 'title', type: { kind: 'string' }, required: true },
            ],
            relations: [rel('category', 'api::category.category', 'Category')],
            media: [{ name: 'cover', multiple: false }],
            components: [],
            dynamicZones: [],
        },
        {
            name: 'ApiCategoryCategory',
            cleanName: 'Category',
            collectionName: 'categories',
            singularName: 'category',
            pluralName: 'categories',
            kind: 'collection',
            attributes: [
                { name: 'name', type: { kind: 'string' }, required: true },
            ],
            relations: [],
            media: [],
            components: [],
            dynamicZones: [],
        },
        {
            name: 'PluginUsersPermissionsUser',
            cleanName: 'User',
            collectionName: 'up_users',
            singularName: 'user',
            pluralName: 'users',
            kind: 'collection',
            attributes: [
                { name: 'username', type: { kind: 'string' }, required: true },
            ],
            relations: [rel('category', 'api::category.category', 'Category')],
            media: [],
            components: [],
            dynamicZones: [],
        },
    ],
    components: [],
}

// Exercises populate narrowing + invalid-key rejection on the generated client.
const ASSERTIONS = `import { StrapiClient } from './client'
import type { Article } from './types'
declare const client: StrapiClient
async function _assert() {
  // populate narrowing preserved: the populated relation key is present
  const a = await client.articles.find({ populate: { category: true } })
  type ElA = (typeof a)[number]
  const _cat: ElA['category'] = null as any
  void _cat
  // @ts-expect-error - an invalid populate key must be rejected
  await client.articles.find({ populate: { notAKey: true } })
  await client.articles.find({ populate: '*' })
  await client.articles.find({ populate: true })
  // without populate the relation key is absent from the base result
  const b = await client.articles.find()
  type ElB = (typeof b)[number]
  // @ts-expect-error - relations are absent without populate
  const _noCat: ElB['category'] = null as any
  void _noCat
}
void _assert
`

describe('generated client type-checks clean without @ts-nocheck', () => {
    let tmpDir: string
    let diagnostics: ts.Diagnostic[]

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-tc-'))
        await new Generator(tmpDir).generate(
            schema,
            undefined,
            undefined,
            '',
            '',
            'ts',
        )

        const files = ['types.ts', 'client.ts', 'index.ts'].map(f =>
            path.join(tmpDir, f),
        )
        // strip the `/* eslint-disable */` + `// @ts-nocheck` header so tsc checks
        for (const f of files) {
            const src = fs
                .readFileSync(f, 'utf-8')
                .replace(/^\/\* eslint-disable \*\/\n?/m, '')
                .replace(/^\/\/ @ts-nocheck\n?/m, '')
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
})
