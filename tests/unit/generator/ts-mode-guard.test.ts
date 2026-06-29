import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { Generator } from '../../../src/generator/index.js'
import { mockSchema } from './fixtures/mock-schema.js'

/**
 * The `--format ts` path writes raw .ts into the consumer's tree; before v2.0.x
 * it did so UNGUARDED, so a generator bug could silently emit a non-compiling
 * client. These tests prove the ts branch now runs the same type-check guard as
 * js mode — failing loudly before writing, and degrading to a warning under
 * `--no-typecheck`. The generated output is type-clean today, so we inject a
 * deliberately-broken client (the only seam needed) to exercise the guard.
 */

const tmpDirs: string[] = []

function freshGenerator(): { gen: Generator; outDir: string } {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-guard-'))
    tmpDirs.push(outDir)
    return { gen: new Generator(outDir), outDir }
}

function injectBrokenClient(gen: Generator): void {
    const g = gen as unknown as {
        typesGenerator: { generate: () => string }
        clientGenerator: { generate: () => string }
        indexGenerator: { generate: () => string }
    }
    g.typesGenerator.generate = () => 'export type Dummy = string\n'
    g.clientGenerator.generate = () => "export const broken: number = 'x'\n"
    g.indexGenerator.generate = () => 'export {}\n'
}

const OUTPUT_FILES = ['types.ts', 'client.ts', 'index.ts']

describe('--format ts type-check guard', () => {
    afterEach(() => {
        for (const d of tmpDirs.splice(0)) {
            fs.rmSync(d, { recursive: true, force: true })
        }
    })

    it('throws on non-compiling output and writes nothing to the consumer tree', async () => {
        const { gen, outDir } = freshGenerator()
        injectBrokenClient(gen)

        await expect(
            gen.generate(mockSchema, [], undefined, '', '', 'ts'),
        ).rejects.toThrow(/failed type-checking/)

        for (const f of OUTPUT_FILES) {
            expect(fs.existsSync(path.join(outDir, f))).toBe(false)
        }
    })

    it('does not create the output directory when the guard throws', async () => {
        const parent = fs.mkdtempSync(
            path.join(os.tmpdir(), 'strapi-types-guard-'),
        )
        tmpDirs.push(parent)
        const target = path.join(parent, 'nested', 'out')
        const gen = new Generator(target)
        injectBrokenClient(gen)

        await expect(
            gen.generate(mockSchema, [], undefined, '', '', 'ts'),
        ).rejects.toThrow(/failed type-checking/)

        expect(fs.existsSync(target)).toBe(false)
    })

    it('with typecheck=false, warns and writes the output anyway', async () => {
        const { gen, outDir } = freshGenerator()
        injectBrokenClient(gen)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await expect(
            gen.generate(mockSchema, [], undefined, '', '', 'ts', false),
        ).resolves.toBeUndefined()

        expect(warn).toHaveBeenCalledWith(
            expect.stringMatching(/failed type-checking/),
        )
        for (const f of OUTPUT_FILES) {
            expect(fs.existsSync(path.join(outDir, f))).toBe(true)
        }
        warn.mockRestore()
    })
})
