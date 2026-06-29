/**
 * Watch command - connects to SSE stream and regenerates types on schema changes
 */

import { createApiClient } from '../utils/api-client.js'
import type { Command } from 'commander'
import { readLocalSchemaHash, requireOutputDir } from '../utils/file-writer.js'
import { SseConnection } from '../../shared/sse-client.js'
import { generate } from './generate.js'

export interface WatchOptions {
    url?: string
    token?: string
    output?: string
    silent?: boolean
    typecheck?: boolean
}

/**
 * Watch for schema changes via SSE
 */
export async function watch(options: WatchOptions): Promise<void> {
    const outputDir = requireOutputDir(options.output)

    const client = createApiClient({
        url: options.url,
        token: options.token,
    })

    // Check if Strapi is reachable
    const isReachable = await client.ping()
    if (!isReachable) {
        console.error(
            `Cannot connect to Strapi at ${options.url || process.env.STRAPI_URL || 'http://localhost:1337'}`,
        )
        console.error(
            'Make sure the Strapi server is running and the strapi-types plugin is enabled.',
        )
        process.exit(1)
    }

    // Initial generation if no types exist
    const initialHash = readLocalSchemaHash(outputDir)
    if (!initialHash) {
        console.log('No existing types found. Generating initial types...')
        await generate({
            url: options.url,
            token: options.token,
            output: outputDir,
            silent: options.silent,
            typecheck: options.typecheck,
        })
    }

    let lastHash = readLocalSchemaHash(outputDir)
    let generating = false

    console.log('Watching for schema changes (SSE)...')
    console.log('Press Ctrl+C to stop.\n')

    const sse = new SseConnection({
        url: client.sseUrl,
        headers: client.getHeaders(),
        async onEvent({ event, data }) {
            if (event !== 'connected' || generating) return

            try {
                const { hash: remoteHash } = JSON.parse(data)

                if (lastHash !== remoteHash) {
                    generating = true
                    console.log(
                        `Schema change detected (${lastHash?.substring(0, 8) || 'none'} -> ${remoteHash.substring(0, 8)}...)`,
                    )
                    console.log('Regenerating types...')

                    const result = await generate({
                        url: options.url,
                        token: options.token,
                        output: outputDir,
                        silent: true,
                        typecheck: options.typecheck,
                    })

                    if (result.success) {
                        console.log('Types regenerated successfully.\n')
                        lastHash = remoteHash
                    } else {
                        console.error(
                            'Failed to regenerate types:',
                            result.error,
                        )
                    }
                    generating = false
                }
            } catch {
                generating = false
            }
        },
        onError(err) {
            // Silence connection errors — Strapi may be restarting
            if (!options.silent) {
                const msg = err instanceof Error ? err.message : String(err)
                if (!msg.includes('ECONNREFUSED')) {
                    console.error(`SSE error: ${msg}`)
                }
            }
        },
    })

    sse.connect()

    // Handle graceful shutdown
    const stop = () => {
        console.log('\nStopping watch...')
        sse.close()
        process.exit(0)
    }

    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
}

/**
 * CLI handler for watch command
 */
export function createWatchCommand(program: Command): void {
    program
        .command('watch')
        .description(
            'Watch for schema changes and regenerate types automatically',
        )
        .option(
            '-u, --url <url>',
            'Strapi API URL (default: STRAPI_URL env or http://localhost:1337)',
        )
        .option(
            '-t, --token <token>',
            'Strapi API token (default: STRAPI_TOKEN env)',
        )
        .option(
            '-o, --output <path>',
            'Output directory (required) — your source tree, e.g. ./src/strapi',
        )
        .option('-s, --silent', 'Suppress regeneration messages')
        .option(
            '--no-typecheck',
            'Write regenerated types even if they fail type-checking (escape hatch for strict-only false positives)',
        )
        .action(async (opts: WatchOptions) => {
            try {
                await watch({
                    url: opts.url,
                    token: opts.token,
                    output: opts.output,
                    silent: opts.silent,
                    typecheck: opts.typecheck,
                })
            } catch (err) {
                console.error((err as Error).message)
                process.exit(1)
            }
        })
}
