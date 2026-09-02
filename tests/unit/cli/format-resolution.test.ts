import { describe, it, expect, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { Command } from 'commander'
import {
    generate,
    createGenerateCommand,
} from '../../../src/cli/commands/generate.js'
import { createWatchCommand } from '../../../src/cli/commands/watch.js'

const dirs: string[] = []

afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
})

// An omitted --format resolves to the format already committed in --output.
// Asserted through the node_modules guard, which only fires for ts and runs
// before any network call: reaching it proves the ts tree was detected.
describe('format resolution from existing output', () => {
    it('generate() picks up a committed ts tree when --format is omitted', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-res-'))
        dirs.push(root)
        const outputDir = path.join(root, 'node_modules', 'x', 'dist')
        fs.mkdirSync(outputDir, { recursive: true })
        fs.writeFileSync(
            path.join(outputDir, 'client.ts'),
            'export const SCHEMA_HASH = "abc"',
            'utf-8',
        )

        const result = await generate({ output: outputDir })

        expect(result.success).toBe(false)
        expect(result.error).toMatch(
            /--format ts cannot write into node_modules/,
        )
    })

    it('an explicit --format still wins over what is on disk', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-res-'))
        dirs.push(root)
        const outputDir = path.join(root, 'node_modules', 'x', 'dist')
        fs.mkdirSync(outputDir, { recursive: true })
        fs.writeFileSync(
            path.join(outputDir, 'client.js'),
            'export const SCHEMA_HASH = "abc"',
            'utf-8',
        )

        const result = await generate({ output: outputDir, format: 'ts' })

        expect(result.success).toBe(false)
        expect(result.error).toMatch(
            /--format ts cannot write into node_modules/,
        )
    })
})

// A commander-level default would hand generate() a literal 'js' on every run
// and the detection above would never see an omitted flag.
describe('--format carries no hard default', () => {
    it.each([
        ['generate', createGenerateCommand],
        ['watch', createWatchCommand],
    ])('%s leaves --format undefined when not passed', (name, register) => {
        const program = new Command()
        register(program)

        const command = program.commands.find(c => c.name() === name)
        const format = command?.options.find(o => o.long === '--format')

        expect(format).toBeDefined()
        expect(format?.defaultValue).toBeUndefined()
    })
})
