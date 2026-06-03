/**
 * Next.js plugin for automatic Strapi type generation.
 *
 * Usage in next.config.ts:
 *
 *   import { withStrapiTypes } from 'strapi-typed-client/next'
 *   export default withStrapiTypes()(nextConfig)
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as path from 'path'

export interface StrapiTypesConfig {
    strapiUrl?: string
    token?: string
    silent?: boolean
    format?: 'js' | 'ts'
    output?: string
}

const _require = createRequire(import.meta.url)

function getPackageDir(): string {
    const pkgJsonPath = _require.resolve('strapi-typed-client/package.json')
    return path.dirname(pkgJsonPath)
}

function defaultOutputDir(): string {
    return path.join(getPackageDir(), 'dist')
}

function resolveOutputDir(config: StrapiTypesConfig): string {
    return config.output
        ? path.resolve(process.cwd(), config.output)
        : defaultOutputDir()
}

/**
 * Read schema hash baked at the top of the generated client. Slices the
 * first few hundred bytes so we don't load the full client just to compare
 * hashes. Tries client.ts (raw, .ts mode) then client.js (compiled, .js mode).
 */
function readLocalHash(outputDir: string): string | null {
    for (const file of ['client.ts', 'client.js']) {
        const p = path.join(outputDir, file)
        let fd: number | undefined
        try {
            fd = fs.openSync(p, 'r')
            const buf = Buffer.alloc(300)
            const read = fs.readSync(fd, buf, 0, 300, 0)
            const head = buf.slice(0, read).toString('utf-8')
            const match = head.match(/SCHEMA_HASH\s*=\s*['"]([^'"]+)['"]/)
            if (match) return match[1]
        } catch {
            /* try next candidate */
        } finally {
            if (fd !== undefined) {
                try {
                    fs.closeSync(fd)
                } catch {
                    /* ignore */
                }
            }
        }
    }
    return null
}

function generatedFilesExist(outputDir: string, format: 'js' | 'ts'): boolean {
    const files =
        format === 'ts'
            ? ['types.ts', 'client.ts', 'index.ts']
            : ['types.d.ts', 'client.d.ts', 'index.d.ts']
    return files.every(f => fs.existsSync(path.join(outputDir, f)))
}

// ANSI colors matching Next.js output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`

function info(silent: boolean, msg: string): void {
    if (!silent) console.log(`${green('○')} ${msg}`)
}

function ok(silent: boolean, msg: string): void {
    if (!silent) console.log(`${green('✓')} ${msg}`)
}

function fail(msg: string): void {
    console.error(`${red('⨯')} ${msg}`)
}

function loading(silent: boolean, msg: string): () => void {
    if (silent) return () => {}
    const frames = ['·  ', '·· ', '···', ' ··', '  ·', '   ']
    let i = 0
    process.stdout.write(`${green('○')} ${msg} ${frames[0]}`)
    const id = setInterval(() => {
        i = (i + 1) % frames.length
        process.stdout.write(`\r${green('○')} ${msg} ${frames[i]}`)
    }, 150)
    return () => {
        clearInterval(id)
        process.stdout.write(`\r\x1b[K`)
    }
}

async function startDevWatch(config: StrapiTypesConfig): Promise<void> {
    const outputDir = resolveOutputDir(config)
    const format: 'js' | 'ts' = config.format ?? 'js'
    const silent = config.silent ?? false
    const url =
        config.strapiUrl || process.env.STRAPI_URL || 'http://localhost:1337'
    const token = config.token || process.env.STRAPI_TOKEN

    const { createApiClient } = await import('../cli/utils/api-client.js')
    const { generate } = await import('../cli/commands/generate.js')
    const { SseConnection } = await import('../shared/sse-client.js')

    const client = createApiClient({ url, token })

    let lastHash = generatedFilesExist(outputDir, format)
        ? readLocalHash(outputDir)
        : null
    let generating = false

    info(silent, `Watching for schema changes ${dim('(SSE)')}`)

    const sse = new SseConnection({
        url: client.sseUrl,
        headers: client.getHeaders(),
        async onEvent({ event, data }) {
            if (event !== 'connected' || generating) return

            try {
                const { hash: remoteHash } = JSON.parse(data)

                if (
                    lastHash !== remoteHash ||
                    !generatedFilesExist(outputDir, format)
                ) {
                    generating = true
                    const stop = loading(silent, 'Regenerating types')

                    const start = Date.now()
                    const result = await generate({
                        url,
                        token,
                        output: outputDir,
                        silent: true,
                        force: true,
                        format,
                    })

                    stop()

                    if (result.success) {
                        ok(
                            silent,
                            `Types regenerated in ${dim(`${Date.now() - start}ms`)}`,
                        )
                        lastHash = remoteHash
                    } else {
                        fail(`Failed to regenerate: ${result.error}`)
                    }
                    generating = false
                }
            } catch {
                generating = false
            }
        },
    })

    sse.connect()

    const cleanup = () => {
        sse.close()
        releaseWatchLock()
    }
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('exit', cleanup)
}

function runBuildGenerate(config: StrapiTypesConfig): void {
    const silent = config.silent ?? false
    const url =
        config.strapiUrl || process.env.STRAPI_URL || 'http://localhost:1337'
    const token = config.token || process.env.STRAPI_TOKEN
    const outputDir = resolveOutputDir(config)
    const format: 'js' | 'ts' = config.format ?? 'js'
    const binPath = path.join(getPackageDir(), 'dist', 'cli', 'index.js')

    const args = [
        binPath,
        'generate',
        '--force',
        '--silent',
        '--output',
        outputDir,
        '--url',
        url,
        '--format',
        format,
    ]

    if (token) {
        args.push('--token', token)
    }

    const stop = loading(silent, 'Generating types')
    const start = Date.now()
    try {
        execFileSync('node', args, { stdio: ['ignore', 'ignore', 'pipe'] })
        stop()
        ok(silent, `Types generated in ${dim(`${Date.now() - start}ms`)}`)
    } catch (error) {
        stop()
        const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim()
        fail(
            `Failed to generate types, using existing if available${stderr ? `\n${stderr}` : ''}`,
        )
    }
}

/**
 * Acquire a PID-based file lock so only one process runs the watcher.
 * Next.js dev spawns multiple worker processes — each would start its own watcher.
 * Lock lives inside the package dir so it's cleaned up on reinstall.
 */
function acquireWatchLock(): boolean {
    const lockFile = path.join(getPackageDir(), 'watch.lock')
    try {
        // Check existing lock
        const existing = fs.readFileSync(lockFile, 'utf-8').trim()
        const pid = Number(existing)
        if (pid && pid !== process.pid) {
            try {
                process.kill(pid, 0) // throws if process is dead
                return false // another process owns the lock
            } catch {
                // stale lock, take over
            }
        }
    } catch {
        // no lock file
    }
    try {
        fs.writeFileSync(lockFile, String(process.pid), 'utf-8')
        return true
    } catch {
        return false
    }
}

function releaseWatchLock(): void {
    try {
        const lockFile = path.join(getPackageDir(), 'watch.lock')
        const existing = fs.readFileSync(lockFile, 'utf-8').trim()
        if (Number(existing) === process.pid) {
            fs.unlinkSync(lockFile)
        }
    } catch {
        // ignore
    }
}

// Detached telemetry/worker processes should never start the watcher
function isMainNextProcess(): boolean {
    return !process.argv.some(
        arg =>
            arg.includes('detached-flush') ||
            arg.includes('next-telemetry') ||
            arg.includes('/worker'),
    )
}

export function withStrapiTypes(config?: StrapiTypesConfig) {
    return <T>(nextConfig: T): T => {
        const cfg = config ?? {}

        if (process.env.NODE_ENV === 'development' && isMainNextProcess()) {
            // next dev — SSE watcher (only one process via PID lock)
            if (acquireWatchLock()) {
                startDevWatch(cfg)
            }
        } else if (process.argv.includes('build')) {
            // next build — one-time sync generation
            runBuildGenerate(cfg)
        }
        // next start — do nothing, types already generated during build

        return nextConfig
    }
}
