/**
 * Init command - scaffolds the committed-codegen workflow: validates the
 * url/output/format choices and writes strapi:generate / strapi:check
 * scripts into the consumer's package.json
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Command } from 'commander'
import { isInsideNodeModules } from '../utils/file-writer.js'
import {
    bold,
    cyan,
    dim,
    green,
    yellow,
    createTerminalPrompter,
    type Prompter,
    type SelectChoice,
} from '../utils/prompt.js'

export interface InitOptions {
    url?: string
    output?: string
    format?: string
    yes?: boolean
    force?: boolean
    silent?: boolean
    cwd?: string
}

export interface ScriptConflict {
    name: string
    current: string
    proposed: string
}

export interface InitResult {
    success: boolean
    error?: string
    packageJsonPath?: string
    scriptsAdded: string[]
    scriptsOverwritten: string[]
    scriptsSkipped: string[]
    conflicts: ScriptConflict[]
}

const DEFAULT_URL = 'http://localhost:1337'
const DEFAULT_OUTPUT = './src/strapi'

/**
 * Validate a URL destined for a committed script. `new URL` alone accepts
 * scheme-less strings like 'localhost:1337' ('localhost:' parses as the
 * protocol), so the scheme must be checked explicitly.
 */
export function validateStrapiUrl(raw: string): string {
    const url = raw.trim().replace(/\/+$/, '')
    let parsed: URL | undefined
    try {
        parsed = new URL(url)
    } catch {
        parsed = undefined
    }
    if (
        !parsed ||
        (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    ) {
        throw new Error(
            `Invalid Strapi URL "${raw.trim()}" — it must start with http:// or https:// (e.g. ${DEFAULT_URL}).`,
        )
    }
    return url
}

function isDefaultUrl(url: string): boolean {
    return new URL(url).href === new URL(DEFAULT_URL).href
}

/**
 * Normalize an output path for embedding into a committed script: POSIX
 * separators and a ./ prefix so the script works for every teammate.
 * Absolute paths are relativized against cwd (or rejected when outside it) —
 * a committed absolute path only works on the machine that ran init.
 */
export function normalizeOutputForScript(output: string, cwd: string): string {
    const raw = output.trim()
    if (path.isAbsolute(raw)) {
        const rel = path.relative(cwd, raw)
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            throw new Error(
                `--output must be inside your project (got ${raw}). ` +
                    `Use a relative path in your source tree, e.g. ${DEFAULT_OUTPUT}.`,
            )
        }
        return toPosixRelative(rel === '' ? '.' : rel)
    }
    return toPosixRelative(raw)
}

function toPosixRelative(p: string): string {
    const posix = p.replace(/\\/g, '/')
    if (
        posix === '.' ||
        posix === '..' ||
        posix.startsWith('./') ||
        posix.startsWith('../')
    ) {
        return posix
    }
    return `./${posix}`
}

export interface InitScriptValues {
    output: string
    format: 'js' | 'ts'
    url?: string
}

export function buildInitScripts(
    values: InitScriptValues,
): Record<string, string> {
    // quote by allowlist, not just whitespace — npm run hands these to sh/cmd
    const arg = (v: string) => (/^[A-Za-z0-9_./:@=-]+$/.test(v) ? v : `"${v}"`)
    const output = ` --output ${arg(values.output)}`
    const format = values.format === 'ts' ? ' --format ts' : ''
    const url = values.url ? ` --url ${arg(values.url)}` : ''
    return {
        'strapi:generate': `strapi-types generate${output}${format}${url}`,
        'strapi:check': `strapi-types check${output}${url}`,
    }
}

export interface ApplyScriptsResult {
    content: string
    changed: boolean
    added: string[]
    overwritten: string[]
    skipped: string[]
    conflicts: ScriptConflict[]
}

function stripBom(raw: string): string {
    return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
}

/**
 * Add scripts to a package.json string while keeping the file's own dialect
 * (BOM, CRLF, indent, trailing newline) so the resulting diff is only the
 * added lines. Returns the original content untouched when nothing changed,
 * which is what makes re-runs byte-identical.
 */
export function applyScriptsToPackageJson(
    raw: string,
    scripts: Record<string, string>,
    force: boolean,
): ApplyScriptsResult {
    const body = stripBom(raw)
    const bom = raw.slice(0, raw.length - body.length)

    let pkg: unknown
    try {
        pkg = JSON.parse(body)
    } catch {
        throw new Error(
            'package.json is not valid JSON — fix it and re-run init.',
        )
    }
    if (typeof pkg !== 'object' || pkg === null || Array.isArray(pkg)) {
        throw new Error(
            'package.json must contain a JSON object at the top level.',
        )
    }
    const record = pkg as Record<string, unknown>
    if (
        record.scripts !== undefined &&
        (typeof record.scripts !== 'object' ||
            record.scripts === null ||
            Array.isArray(record.scripts))
    ) {
        throw new Error(
            'package.json has a non-object "scripts" field — fix it and re-run init.',
        )
    }

    const target = (record.scripts as Record<string, unknown> | undefined) ?? {}
    record.scripts = target

    const added: string[] = []
    const overwritten: string[] = []
    const skipped: string[] = []
    const conflicts: ScriptConflict[] = []

    for (const [name, proposed] of Object.entries(scripts)) {
        const current = target[name]
        if (current === undefined) {
            target[name] = proposed
            added.push(name)
        } else if (current === proposed) {
            skipped.push(name)
        } else if (force) {
            target[name] = proposed
            overwritten.push(name)
        } else {
            conflicts.push({ name, current: String(current), proposed })
        }
    }

    const changed = added.length > 0 || overwritten.length > 0
    if (!changed) {
        return { content: raw, changed, added, overwritten, skipped, conflicts }
    }

    const eol = body.includes('\r\n') ? '\r\n' : '\n'
    const indent = body.match(/^([ \t]+)"/m)?.[1] ?? '  '
    let out = JSON.stringify(pkg, null, indent)
    if (eol === '\r\n') {
        out = out.replace(/\n/g, eol)
    }
    if (/\r?\n$/.test(body)) {
        out += eol
    }
    return {
        content: bom + out,
        changed,
        added,
        overwritten,
        skipped,
        conflicts,
    }
}

function normalizeFormat(raw: string): 'js' | 'ts' | null {
    const value = raw.trim().toLowerCase()
    return value === 'js' || value === 'ts' ? value : null
}

function resolveOutput(rawOutput: string, cwd: string): string {
    if (!rawOutput.trim()) {
        throw new Error(
            `No output directory specified. Pass --output pointing at your source tree, e.g. --output ${DEFAULT_OUTPUT}.`,
        )
    }
    const normalized = normalizeOutputForScript(rawOutput, cwd)
    if (isInsideNodeModules(path.resolve(cwd, normalized))) {
        throw new Error(
            `init sets up committed codegen — --output cannot point inside node_modules (${rawOutput.trim()}). ` +
                `Choose a directory in your source tree, e.g. ${DEFAULT_OUTPUT}.`,
        )
    }
    return normalized
}

const FORMAT_CHOICES: Array<SelectChoice<'js' | 'ts'>> = [
    { value: 'js', label: 'js', hint: 'compiled .js + .d.ts, no build step' },
    { value: 'ts', label: 'ts', hint: 'raw .ts for bundlers and monorepos' },
]

function askFormat(prompter: Prompter): Promise<'js' | 'ts'> {
    return prompter.select('Output format', FORMAT_CHOICES, 'js')
}

async function askOutput(prompter: Prompter, cwd: string): Promise<string> {
    for (;;) {
        const answer = (
            await prompter.text('Output directory', DEFAULT_OUTPUT)
        ).trim()
        try {
            return resolveOutput(answer === '' ? DEFAULT_OUTPUT : answer, cwd)
        } catch (error) {
            console.error((error as Error).message)
        }
    }
}

/**
 * Returns undefined when the user accepts the bracket default (empty answer):
 * env-derived and default URLs must stay out of committed scripts, otherwise
 * one developer's STRAPI_URL gets frozen for the whole team and shadows env
 * at generate time (flags take precedence over env).
 */
async function askUrl(prompter: Prompter): Promise<string | undefined> {
    const shown = process.env.STRAPI_URL || DEFAULT_URL
    for (;;) {
        const answer = (await prompter.text('Strapi URL', shown)).trim()
        if (answer === '') return undefined
        try {
            return validateStrapiUrl(answer)
        } catch (error) {
            console.error((error as Error).message)
        }
    }
}

function detectPackageManager(pkg: Record<string, unknown>): {
    install: string
    run: (script: string) => string
} {
    const pm = typeof pkg.packageManager === 'string' ? pkg.packageManager : ''
    if (pm.startsWith('yarn')) {
        return { install: 'yarn add -D', run: s => `yarn ${s}` }
    }
    if (pm.startsWith('pnpm')) {
        return { install: 'pnpm add -D', run: s => `pnpm ${s}` }
    }
    if (pm.startsWith('bun')) {
        return { install: 'bun add -d', run: s => `bun run ${s}` }
    }
    return { install: 'npm install -D', run: s => `npm run ${s}` }
}

function hasDependency(pkg: Record<string, unknown>, name: string): boolean {
    for (const key of ['dependencies', 'devDependencies']) {
        const deps = pkg[key]
        if (deps && typeof deps === 'object' && name in deps) return true
    }
    return false
}

function printNextSteps(pkg: Record<string, unknown>, output: string): void {
    const pm = detectPackageManager(pkg)
    const steps: string[] = []
    if (!hasDependency(pkg, 'strapi-typed-client')) {
        steps.push(`Install the package: ${pm.install} strapi-typed-client`)
    }
    steps.push(
        `Enable the plugin in your Strapi project: config/plugins.ts → 'strapi-typed-client': { enabled: true }`,
        `With Strapi running: ${pm.run('strapi:generate')}`,
        `Commit the generated directory (${output})`,
    )
    console.log(`\n${bold('Next steps:')}`)
    steps.forEach((step, i) => console.log(`  ${cyan(`${i + 1}.`)} ${step}`))
    console.log(
        '\n' +
            dim(
                'Tips: set STRAPI_TOKEN if the schema API requires auth. ' +
                    'During development `strapi-types watch` regenerates on schema changes. ' +
                    'Next.js: the withStrapiTypes wrapper regenerates automatically on dev/build ' +
                    '(https://boxlab-ltd.github.io/strapi-typed-client/guide/nextjs) — ' +
                    'the scripts above remain useful for CI checks and manual runs.',
            ),
    )
}

/**
 * Scaffold the committed-codegen setup. Never throws and never exits — errors
 * come back in the result (exit codes live in the commander wrapper).
 * `prompter` is injectable for tests; the terminal implementation is only
 * created when prompting will actually happen.
 */
export async function init(
    options: InitOptions,
    prompter?: Prompter,
): Promise<InitResult> {
    const fail = (error: string): InitResult => ({
        success: false,
        error,
        scriptsAdded: [],
        scriptsOverwritten: [],
        scriptsSkipped: [],
        conflicts: [],
    })

    const cwd = options.cwd ?? process.cwd()
    const packageJsonPath = path.join(cwd, 'package.json')

    let raw: string
    try {
        raw = fs.readFileSync(packageJsonPath, 'utf-8')
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return fail(
                `No package.json found in ${cwd}. Run strapi-types init from your project root.`,
            )
        }
        return fail(
            `Could not read ${packageJsonPath}: ${(error as Error).message}`,
        )
    }
    try {
        JSON.parse(stripBom(raw))
    } catch {
        return fail('package.json is not valid JSON — fix it and re-run init.')
    }

    // Validate flag-provided values up front so a typo'd flag fails fast
    // instead of after the user has answered the interactive prompts
    let scriptUrl: string | undefined
    if (options.url !== undefined) {
        try {
            scriptUrl = validateStrapiUrl(options.url)
        } catch (error) {
            return fail((error as Error).message)
        }
    }
    let output: string | undefined
    if (options.output !== undefined) {
        try {
            output = resolveOutput(options.output, cwd)
        } catch (error) {
            return fail((error as Error).message)
        }
    }
    let format: 'js' | 'ts' | undefined
    if (options.format !== undefined) {
        const value = normalizeFormat(options.format)
        if (!value) {
            return fail(
                `Invalid --format value: ${options.format}. Expected 'js' or 'ts'.`,
            )
        }
        format = value
    }

    const wantsPrompt = !options.yes && !options.silent
    const canPrompt =
        prompter !== undefined ||
        (process.stdin.isTTY === true && process.stdout.isTTY === true)
    const missing =
        options.url === undefined ||
        options.output === undefined ||
        options.format === undefined

    if (wantsPrompt && !canPrompt && missing && !options.silent) {
        console.log(
            'Non-interactive terminal — using defaults (pass --url/--output/--format or -y to silence this).',
        )
    }

    const prompting = wantsPrompt && canPrompt && missing
    const prompts =
        prompter ?? (prompting ? createTerminalPrompter() : undefined)

    if (prompting && !options.silent) {
        console.log(
            `\n${bold('strapi-types init')} ${dim('— committed-codegen setup')}`,
        )
    }

    if (options.url === undefined && prompting && prompts) {
        scriptUrl = await askUrl(prompts)
    }
    if (scriptUrl && isDefaultUrl(scriptUrl)) {
        scriptUrl = undefined
    }

    if (output === undefined) {
        output =
            prompting && prompts
                ? await askOutput(prompts, cwd)
                : DEFAULT_OUTPUT
    }

    if (format === undefined) {
        format = prompting && prompts ? await askFormat(prompts) : 'js'
    }
    if (
        scriptUrl &&
        new URL(scriptUrl).pathname.endsWith('/api') &&
        !options.silent
    ) {
        console.warn(
            `${yellow('▲')} Note: the URL should be the Strapi root, not .../api (got ${scriptUrl}).`,
        )
    }

    const scripts = buildInitScripts({ output, format, url: scriptUrl })
    let applied: ApplyScriptsResult
    try {
        applied = applyScriptsToPackageJson(
            raw,
            scripts,
            options.force ?? false,
        )
    } catch (error) {
        return fail((error as Error).message)
    }

    if (applied.changed) {
        try {
            fs.writeFileSync(packageJsonPath, applied.content, 'utf-8')
        } catch (error) {
            return fail(
                `Could not write ${packageJsonPath}: ${(error as Error).message}`,
            )
        }
    }

    if (applied.conflicts.length > 0) {
        // stderr on purpose: --silent must not be able to hide a not-applied state
        console.error(
            `${yellow('▲')} Existing scripts in ${packageJsonPath} differ from what init proposes:`,
        )
        for (const conflict of applied.conflicts) {
            console.error(
                `  "${conflict.name}"\n    current:  ${conflict.current}\n    proposed: ${conflict.proposed}`,
            )
        }
        console.error('Re-run with --force to overwrite them.')
    }

    if (!options.silent) {
        const touched = [...applied.added, ...applied.overwritten]
        if (touched.length > 0) {
            console.log(
                `${green('✔')} Updated ${packageJsonPath}: ${touched.map(n => `"${n}"`).join(', ')}`,
            )
        } else if (applied.conflicts.length === 0) {
            console.log(
                `${green('✔')} Already configured — ${packageJsonPath} left untouched.`,
            )
        }
        printNextSteps(
            JSON.parse(stripBom(raw)) as Record<string, unknown>,
            output,
        )
    }

    return {
        success: true,
        packageJsonPath,
        scriptsAdded: applied.added,
        scriptsOverwritten: applied.overwritten,
        scriptsSkipped: applied.skipped,
        conflicts: applied.conflicts,
    }
}

interface InitCliOptions {
    url?: string
    output?: string
    format?: string
    yes?: boolean
    force?: boolean
    silent?: boolean
}

/**
 * CLI handler for init command
 */
export function createInitCommand(program: Command): void {
    program
        .command('init')
        .description(
            'Set up the committed-codegen workflow: add strapi:generate / strapi:check scripts to package.json',
        )
        .option(
            '-u, --url <url>',
            `Strapi API URL to bake into the scripts (omit to rely on STRAPI_URL env or ${DEFAULT_URL})`,
        )
        .option(
            '-o, --output <path>',
            `Output directory for generated types (default: ${DEFAULT_OUTPUT})`,
        )
        .option(
            '--format <js|ts>',
            'Output format: js (compiled .js + .d.ts, default) or ts (raw .ts for bundlers/monorepos)',
        )
        .option(
            '-y, --yes',
            'Accept defaults for any option not passed; never prompt',
        )
        .option(
            '-f, --force',
            'Overwrite conflicting strapi:* scripts in package.json (other keys are never touched)',
        )
        .option(
            '-s, --silent',
            'Suppress output messages (also skips prompts, like --yes)',
        )
        .action(async (opts: InitCliOptions) => {
            const result = await init(opts)

            if (!result.success) {
                console.error('Init failed:', result.error)
                process.exit(1)
            }

            if (result.conflicts.length > 0) {
                process.exit(1)
            }
        })
}
