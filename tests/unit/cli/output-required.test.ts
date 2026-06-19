import { describe, it, expect } from 'vitest'
import { generate } from '../../../src/cli/commands/generate.js'
import { check } from '../../../src/cli/commands/check.js'
import { watch } from '../../../src/cli/commands/watch.js'

// The output directory is required: there is no implicit node_modules default.
// requireOutputDir throws before any network call, so these never hit Strapi.
describe('output is required', () => {
    it('generate() fails with an actionable error when --output is omitted', async () => {
        const result = await generate({})
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/No output directory specified/)
        expect(result.error).toMatch(/--output/)
        expect(result.filesWritten).toEqual([])
    })

    it('check() returns an actionable error when --output is omitted', async () => {
        const result = await check({})
        expect(result.inSync).toBe(false)
        expect(result.error).toMatch(/No output directory specified/)
    })

    it('watch() rejects when --output is omitted', async () => {
        await expect(watch({})).rejects.toThrow(/No output directory specified/)
    })

    it('treats empty / whitespace --output as missing across commands', async () => {
        const gen = await generate({ output: '' })
        expect(gen.success).toBe(false)
        expect(gen.error).toMatch(/No output directory specified/)

        const chk = await check({ output: '   ' })
        expect(chk.inSync).toBe(false)
        expect(chk.error).toMatch(/No output directory specified/)

        await expect(watch({ output: '' })).rejects.toThrow(
            /No output directory specified/,
        )
    })
})
