import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { Command } from 'commander'
import {
    init,
    createInitCommand,
    buildInitScripts,
    applyScriptsToPackageJson,
    validateStrapiUrl,
    normalizeOutputForScript,
} from '../../../src/cli/commands/init.js'
import type { Prompter } from '../../../src/cli/utils/prompt.js'

const BOM = String.fromCharCode(0xfeff)
const tmpDirs: string[] = []

function freshDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-types-init-'))
    tmpDirs.push(dir)
    return dir
}

function freshProjectDir(pkg: string | object = { name: 'app' }): string {
    const dir = freshDir()
    const content =
        typeof pkg === 'string' ? pkg : JSON.stringify(pkg, null, 2) + '\n'
    fs.writeFileSync(path.join(dir, 'package.json'), content, 'utf-8')
    return dir
}

function readRawPkg(dir: string): string {
    return fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')
}

function readPkg(dir: string): Record<string, Record<string, string>> {
    return JSON.parse(readRawPkg(dir))
}

const neverPrompter: Prompter = {
    text: async question => {
        throw new Error(`unexpected prompt: ${question}`)
    },
    select: async question => {
        throw new Error(`unexpected prompt: ${question}`)
    },
}

function stubPrompter(
    config: {
        text?: (question: string) => string
        select?: 'js' | 'ts'
    } = {},
) {
    const text = vi.fn(
        async (question: string) => config.text?.(question) ?? '',
    )
    const select = vi.fn(
        async (_question: string, _choices: unknown, defaultValue: string) =>
            config.select ?? defaultValue,
    )
    return { text, select, prompter: { text, select } as unknown as Prompter }
}

afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true })
    }
    vi.restoreAllMocks()
})

describe('validateStrapiUrl', () => {
    it('accepts http and https URLs, trimmed', () => {
        expect(validateStrapiUrl(' http://localhost:1337 ')).toBe(
            'http://localhost:1337',
        )
        expect(validateStrapiUrl('https://cms.example.com')).toBe(
            'https://cms.example.com',
        )
    })

    it('strips trailing slashes', () => {
        expect(validateStrapiUrl('http://cms.example.com/')).toBe(
            'http://cms.example.com',
        )
    })

    it('rejects scheme-less URLs that new URL() would accept', () => {
        expect(() => validateStrapiUrl('localhost:1337')).toThrow(
            /must start with http:\/\/ or https:\/\//,
        )
    })

    it('rejects non-http protocols and garbage', () => {
        expect(() => validateStrapiUrl('ftp://cms.example.com')).toThrow(
            /must start with/,
        )
        expect(() => validateStrapiUrl('not a url')).toThrow(
            /Invalid Strapi URL/,
        )
    })
})

describe('normalizeOutputForScript', () => {
    const cwd = '/project/root'

    it('adds a ./ prefix to bare relative paths', () => {
        expect(normalizeOutputForScript('src/strapi', cwd)).toBe('./src/strapi')
    })

    it('keeps ./ and ../ paths as-is', () => {
        expect(normalizeOutputForScript('./src/strapi', cwd)).toBe(
            './src/strapi',
        )
        expect(normalizeOutputForScript('../shared/strapi', cwd)).toBe(
            '../shared/strapi',
        )
    })

    it('converts backslash separators to POSIX', () => {
        expect(normalizeOutputForScript('.\\src\\strapi', cwd)).toBe(
            './src/strapi',
        )
    })

    it('relativizes an absolute path inside the project', () => {
        expect(
            normalizeOutputForScript(path.join(cwd, 'src', 'strapi'), cwd),
        ).toBe('./src/strapi')
    })

    it('rejects an absolute path outside the project', () => {
        expect(() => normalizeOutputForScript('/somewhere/else', cwd)).toThrow(
            /inside your project/,
        )
    })
})

describe('buildInitScripts', () => {
    it('emits the minimal pair for the js default', () => {
        expect(
            buildInitScripts({ output: './src/strapi', format: 'js' }),
        ).toEqual({
            'strapi:generate': 'strapi-types generate --output ./src/strapi',
            'strapi:check': 'strapi-types check --output ./src/strapi',
        })
    })

    it('adds --format ts to generate only', () => {
        const scripts = buildInitScripts({
            output: './src/strapi',
            format: 'ts',
        })
        expect(scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi --format ts',
        )
        expect(scripts['strapi:check']).toBe(
            'strapi-types check --output ./src/strapi',
        )
    })

    it('adds --url to both scripts when given', () => {
        const scripts = buildInitScripts({
            output: './src/strapi',
            format: 'js',
            url: 'https://cms.example.com',
        })
        expect(scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi --url https://cms.example.com',
        )
        expect(scripts['strapi:check']).toBe(
            'strapi-types check --output ./src/strapi --url https://cms.example.com',
        )
    })

    it('quotes values containing whitespace', () => {
        const scripts = buildInitScripts({
            output: './my types',
            format: 'js',
        })
        expect(scripts['strapi:generate']).toBe(
            'strapi-types generate --output "./my types"',
        )
    })

    it('quotes values containing shell metacharacters', () => {
        const scripts = buildInitScripts({
            output: './types&gen',
            format: 'js',
            url: 'http://cms.example.com/root?a=1&b=2',
        })
        expect(scripts['strapi:generate']).toBe(
            'strapi-types generate --output "./types&gen" --url "http://cms.example.com/root?a=1&b=2"',
        )
    })
})

describe('applyScriptsToPackageJson', () => {
    const scripts = {
        'strapi:generate': 'strapi-types generate --output ./src/strapi',
        'strapi:check': 'strapi-types check --output ./src/strapi',
    }

    it('adds scripts and keeps existing keys', () => {
        const raw = JSON.stringify(
            { name: 'app', scripts: { dev: 'next dev' } },
            null,
            2,
        )
        const result = applyScriptsToPackageJson(raw, scripts, false)
        expect(result.added).toEqual(['strapi:generate', 'strapi:check'])
        expect(result.changed).toBe(true)
        const pkg = JSON.parse(result.content)
        expect(pkg.scripts.dev).toBe('next dev')
        expect(pkg.scripts['strapi:generate']).toBe(scripts['strapi:generate'])
    })

    it('creates the scripts key when absent', () => {
        const result = applyScriptsToPackageJson(
            JSON.stringify({ name: 'app' }, null, 2),
            scripts,
            false,
        )
        expect(JSON.parse(result.content).scripts['strapi:check']).toBe(
            scripts['strapi:check'],
        )
    })

    it('skips identical scripts and returns the input untouched', () => {
        const raw = JSON.stringify({ name: 'app', scripts }, null, 2)
        const result = applyScriptsToPackageJson(raw, scripts, false)
        expect(result.changed).toBe(false)
        expect(result.skipped).toEqual(['strapi:generate', 'strapi:check'])
        expect(result.content).toBe(raw)
    })

    it('reports conflicts without touching them when force is off', () => {
        const raw = JSON.stringify(
            { name: 'app', scripts: { 'strapi:generate': 'echo custom' } },
            null,
            2,
        )
        const result = applyScriptsToPackageJson(raw, scripts, false)
        expect(result.conflicts).toEqual([
            {
                name: 'strapi:generate',
                current: 'echo custom',
                proposed: scripts['strapi:generate'],
            },
        ])
        expect(result.added).toEqual(['strapi:check'])
        expect(JSON.parse(result.content).scripts['strapi:generate']).toBe(
            'echo custom',
        )
    })

    it('overwrites conflicting scripts with force', () => {
        const raw = JSON.stringify(
            { name: 'app', scripts: { 'strapi:generate': 'echo custom' } },
            null,
            2,
        )
        const result = applyScriptsToPackageJson(raw, scripts, true)
        expect(result.overwritten).toEqual(['strapi:generate'])
        expect(result.conflicts).toEqual([])
        expect(JSON.parse(result.content).scripts['strapi:generate']).toBe(
            scripts['strapi:generate'],
        )
    })

    it('rejects a non-object scripts field', () => {
        for (const bad of ['null', '[]', '"x"']) {
            expect(() =>
                applyScriptsToPackageJson(
                    `{"name":"app","scripts":${bad}}`,
                    scripts,
                    false,
                ),
            ).toThrow(/non-object "scripts"/)
        }
    })

    it('rejects invalid JSON with an actionable message', () => {
        expect(() =>
            applyScriptsToPackageJson('{oops', scripts, false),
        ).toThrow(/not valid JSON/)
    })

    it('preserves 4-space and tab indentation', () => {
        for (const indent of ['    ', '\t']) {
            const raw = JSON.stringify({ name: 'app' }, null, indent)
            const result = applyScriptsToPackageJson(raw, scripts, false)
            expect(result.content).toContain(`\n${indent}"name"`)
            expect(result.content).toContain(`\n${indent}"scripts"`)
        }
    })

    it('preserves CRLF line endings', () => {
        const raw = JSON.stringify({ name: 'app' }, null, 2).replace(
            /\n/g,
            '\r\n',
        )
        const result = applyScriptsToPackageJson(raw, scripts, false)
        expect(result.content).toContain('\r\n')
        expect(result.content).not.toMatch(/[^\r]\n/)
    })

    it('preserves a leading BOM', () => {
        const raw = BOM + JSON.stringify({ name: 'app' }, null, 2)
        const result = applyScriptsToPackageJson(raw, scripts, false)
        expect(result.content.charCodeAt(0)).toBe(0xfeff)
        expect(JSON.parse(result.content.slice(1)).scripts).toBeTruthy()
    })

    it('preserves presence and absence of a trailing newline', () => {
        const base = JSON.stringify({ name: 'app' }, null, 2)
        expect(
            applyScriptsToPackageJson(base + '\n', scripts, false).content,
        ).toMatch(/\n$/)
        expect(
            applyScriptsToPackageJson(base, scripts, false).content,
        ).not.toMatch(/\n$/)
    })
})

describe('init', () => {
    it('writes the script pair for the js default', async () => {
        const dir = freshProjectDir()
        const result = await init({
            cwd: dir,
            output: './src/strapi',
            format: 'js',
            silent: true,
        })
        expect(result.success).toBe(true)
        expect(result.packageJsonPath).toBe(path.join(dir, 'package.json'))
        expect(result.scriptsAdded).toEqual(['strapi:generate', 'strapi:check'])
        expect(readPkg(dir).scripts).toEqual({
            'strapi:generate': 'strapi-types generate --output ./src/strapi',
            'strapi:check': 'strapi-types check --output ./src/strapi',
        })
    })

    it('falls back to defaults with --yes and never prompts', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const dir = freshProjectDir()
        const result = await init({ cwd: dir, yes: true }, neverPrompter)
        expect(result.success).toBe(true)
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi',
        )
    })

    it('never prompts with --silent alone', async () => {
        const dir = freshProjectDir()
        const result = await init({ cwd: dir, silent: true }, neverPrompter)
        expect(result.success).toBe(true)
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi',
        )
    })

    it('proceeds with defaults and a notice in a non-interactive terminal', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const dir = freshProjectDir()
        const result = await init({ cwd: dir })
        expect(result.success).toBe(true)
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi',
        )
        expect(log).toHaveBeenCalledWith(
            expect.stringMatching(/Non-interactive terminal/),
        )
    })

    it('suppresses the non-interactive notice with --silent', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        await init({ cwd: freshProjectDir(), silent: true })
        expect(log).not.toHaveBeenCalled()
    })

    it('bakes --format ts and an explicit non-default --url', async () => {
        const dir = freshProjectDir()
        await init({
            cwd: dir,
            output: 'src/strapi',
            format: 'ts',
            url: 'https://cms.example.com/',
            silent: true,
        })
        expect(readPkg(dir).scripts).toEqual({
            'strapi:generate':
                'strapi-types generate --output ./src/strapi --format ts --url https://cms.example.com',
            'strapi:check':
                'strapi-types check --output ./src/strapi --url https://cms.example.com',
        })
    })

    it('omits --url when the explicit value equals the default', async () => {
        const dir = freshProjectDir()
        await init({
            cwd: dir,
            output: './src/strapi',
            url: 'http://localhost:1337/',
            silent: true,
        })
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi',
        )
    })

    it('never bakes a STRAPI_URL env value into the scripts', async () => {
        const original = process.env.STRAPI_URL
        process.env.STRAPI_URL = 'https://staging.example.com'
        try {
            const dir = freshProjectDir()
            await init({ cwd: dir, yes: true, silent: true })
            expect(readPkg(dir).scripts['strapi:generate']).toBe(
                'strapi-types generate --output ./src/strapi',
            )
        } finally {
            if (original === undefined) delete process.env.STRAPI_URL
            else process.env.STRAPI_URL = original
        }
    })

    it('is idempotent — a second run changes nothing', async () => {
        const dir = freshProjectDir()
        const options = {
            cwd: dir,
            output: './src/strapi',
            silent: true,
        }
        await init(options)
        const firstWrite = readRawPkg(dir)
        const second = await init(options)
        expect(second.scriptsAdded).toEqual([])
        expect(second.scriptsSkipped).toEqual([
            'strapi:generate',
            'strapi:check',
        ])
        expect(readRawPkg(dir)).toBe(firstWrite)
    })

    it('reports conflicts on stderr without touching them', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const dir = freshProjectDir({
            name: 'app',
            scripts: { 'strapi:generate': 'echo custom' },
        })
        const result = await init({
            cwd: dir,
            output: './src/strapi',
            silent: true,
        })
        expect(result.success).toBe(true)
        expect(result.conflicts).toHaveLength(1)
        expect(result.scriptsAdded).toEqual(['strapi:check'])
        expect(readPkg(dir).scripts['strapi:generate']).toBe('echo custom')
        expect(error).toHaveBeenCalledWith(
            expect.stringMatching(/--force to overwrite/),
        )
    })

    it('overwrites conflicting scripts with --force', async () => {
        const dir = freshProjectDir({
            name: 'app',
            scripts: { 'strapi:generate': 'echo custom' },
        })
        const result = await init({
            cwd: dir,
            output: './src/strapi',
            force: true,
            silent: true,
        })
        expect(result.conflicts).toEqual([])
        expect(result.scriptsOverwritten).toEqual(['strapi:generate'])
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi',
        )
    })

    it('fails actionably when there is no package.json', async () => {
        const result = await init({ cwd: freshDir(), yes: true, silent: true })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/No package\.json found/)
    })

    it('rejects an invalid --format', async () => {
        const result = await init({
            cwd: freshProjectDir(),
            output: './src/strapi',
            format: 'md',
            silent: true,
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/Invalid --format/)
    })

    it('rejects an invalid --url before writing anything', async () => {
        const dir = freshProjectDir()
        const before = readRawPkg(dir)
        const result = await init({
            cwd: dir,
            output: './src/strapi',
            url: 'localhost:1337',
            silent: true,
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/http:\/\//)
        expect(readRawPkg(dir)).toBe(before)
    })

    it('rejects node_modules output for both formats before writing', async () => {
        for (const format of ['js', 'ts']) {
            const dir = freshProjectDir()
            const before = readRawPkg(dir)
            const result = await init({
                cwd: dir,
                output: './node_modules/strapi-typed-client/dist',
                format,
                silent: true,
            })
            expect(result.success).toBe(false)
            expect(result.error).toMatch(/node_modules/)
            expect(readRawPkg(dir)).toBe(before)
        }
    })

    it('uses typed prompt answers over defaults', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const dir = freshProjectDir()
        const { prompter, text, select } = stubPrompter({
            text: question =>
                question.startsWith('Strapi URL')
                    ? 'https://cms.example.com'
                    : 'src/types/strapi',
            select: 'ts',
        })
        const result = await init({ cwd: dir }, prompter)
        expect(result.success).toBe(true)
        expect(text).toHaveBeenCalledTimes(2)
        expect(select).toHaveBeenCalledTimes(1)
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/types/strapi --format ts --url https://cms.example.com',
        )
    })

    it('treats empty prompt answers as defaults without baking --url', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const dir = freshProjectDir()
        const result = await init({ cwd: dir }, stubPrompter().prompter)
        expect(result.success).toBe(true)
        expect(readPkg(dir).scripts).toEqual({
            'strapi:generate': 'strapi-types generate --output ./src/strapi',
            'strapi:check': 'strapi-types check --output ./src/strapi',
        })
    })

    it('offers js/ts choices with js as the select default', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const { prompter, select } = stubPrompter()
        await init({ cwd: freshProjectDir() }, prompter)
        expect(select).toHaveBeenCalledWith(
            expect.stringMatching(/Output format/),
            [
                expect.objectContaining({ value: 'js' }),
                expect.objectContaining({ value: 'ts' }),
            ],
            'js',
        )
    })

    it('re-prompts on an invalid URL answer', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const dir = freshProjectDir()
        const urlAnswers = ['localhost:1337', 'https://cms.example.com']
        const { prompter } = stubPrompter({
            text: question =>
                question.startsWith('Strapi URL')
                    ? (urlAnswers.shift() ?? '')
                    : '',
        })
        const result = await init({ cwd: dir }, prompter)
        expect(result.success).toBe(true)
        expect(error).toHaveBeenCalledWith(
            expect.stringMatching(/Invalid Strapi URL/),
        )
        expect(readPkg(dir).scripts['strapi:check']).toBe(
            'strapi-types check --output ./src/strapi --url https://cms.example.com',
        )
    })

    it('only asks for options that were not passed as flags', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const dir = freshProjectDir()
        const { prompter, text, select } = stubPrompter({ select: 'ts' })
        await init(
            { cwd: dir, url: 'https://cms.example.com', output: './gen' },
            prompter,
        )
        expect(text).not.toHaveBeenCalled()
        expect(select).toHaveBeenCalledTimes(1)
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./gen --format ts --url https://cms.example.com',
        )
    })

    it('re-prompts on an invalid output answer', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const dir = freshProjectDir()
        const outputAnswers = ['./node_modules/x', './gen']
        const { prompter } = stubPrompter({
            text: question =>
                question.startsWith('Output directory')
                    ? (outputAnswers.shift() ?? '')
                    : '',
        })
        const result = await init({ cwd: dir }, prompter)
        expect(result.success).toBe(true)
        expect(error).toHaveBeenCalledWith(
            expect.stringMatching(/node_modules/),
        )
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./gen',
        )
    })

    it('shows the STRAPI_URL env value as the URL prompt default', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const original = process.env.STRAPI_URL
        process.env.STRAPI_URL = 'https://staging.example.com'
        try {
            const { prompter, text } = stubPrompter()
            await init({ cwd: freshProjectDir() }, prompter)
            expect(text).toHaveBeenCalledWith(
                'Strapi URL',
                'https://staging.example.com',
            )
        } finally {
            if (original === undefined) delete process.env.STRAPI_URL
            else process.env.STRAPI_URL = original
        }
    })

    it('rejects invalid JSON before asking anything', async () => {
        const dir = freshProjectDir('{oops')
        const { prompter, text, select } = stubPrompter()
        const result = await init({ cwd: dir }, prompter)
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/not valid JSON/)
        expect(text).not.toHaveBeenCalled()
        expect(select).not.toHaveBeenCalled()
    })

    it('rejects invalid flag values before asking anything', async () => {
        const { prompter, text, select } = stubPrompter()
        const result = await init(
            { cwd: freshProjectDir(), format: 'md' },
            prompter,
        )
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/Invalid --format/)
        expect(text).not.toHaveBeenCalled()
        expect(select).not.toHaveBeenCalled()
    })

    it('returns an error result when package.json is not writable', async () => {
        const dir = freshProjectDir()
        fs.chmodSync(path.join(dir, 'package.json'), 0o444)
        try {
            const result = await init({
                cwd: dir,
                output: './src/strapi',
                silent: true,
            })
            expect(result.success).toBe(false)
            expect(result.error).toMatch(/Could not write/)
        } finally {
            fs.chmodSync(path.join(dir, 'package.json'), 0o644)
        }
    })
})

describe('createInitCommand', () => {
    async function runCli(dir: string, args: string[]): Promise<number[]> {
        const exits: number[] = []
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            exits.push(code ?? 0)
        }) as never)
        const previousCwd = process.cwd()
        process.chdir(dir)
        try {
            const program = new Command()
            createInitCommand(program)
            await program.parseAsync(['init', ...args], { from: 'user' })
        } finally {
            process.chdir(previousCwd)
        }
        return exits
    }

    it('exits 1 when unresolved conflicts remain', async () => {
        const dir = freshProjectDir({
            name: 'app',
            scripts: { 'strapi:generate': 'echo custom' },
        })
        const exits = await runCli(dir, [
            '--output',
            './src/strapi',
            '--silent',
        ])
        expect(exits).toEqual([1])
    })

    it('exits 1 when init fails', async () => {
        const exits = await runCli(freshDir(), ['--yes', '--silent'])
        expect(exits).toEqual([1])
    })

    it('exits cleanly on success', async () => {
        const dir = freshProjectDir()
        const exits = await runCli(dir, [
            '--output',
            './src/strapi',
            '--silent',
        ])
        expect(exits).toEqual([])
        expect(readPkg(dir).scripts['strapi:generate']).toBe(
            'strapi-types generate --output ./src/strapi',
        )
    })
})
