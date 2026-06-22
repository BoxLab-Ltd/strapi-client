/**
 * Check command - verifies that local types are in sync with remote schema
 * Returns exit code 0 if in sync, 1 if out of sync
 */

import type { Command } from 'commander'
import { createApiClient } from '../utils/api-client.js'
import {
    readLocalSchemaHash,
    readLocalGeneratorVersion,
    requireOutputDir,
} from '../utils/file-writer.js'
import { getGeneratorVersion } from '../../shared/version.js'

export interface CheckOptions {
    url?: string
    token?: string
    output?: string
    silent?: boolean
}

export interface CheckResult {
    inSync: boolean
    localHash: string | null
    remoteHash: string | null
    error?: string
}

/**
 * Check if local types are in sync with remote schema
 */
export async function check(options: CheckOptions): Promise<CheckResult> {
    try {
        const outputDir = requireOutputDir(options.output)

        // Read local hash
        const localHash = readLocalSchemaHash(outputDir)

        if (!localHash) {
            return {
                inSync: false,
                localHash: null,
                remoteHash: null,
                error: `No generated client found in ${outputDir}. Run 'strapi-types generate' first.`,
            }
        }

        // Warn (non-fatal) when committed types were produced by a different
        // CLI version than the one installed — they may be missing newer
        // generator fixes/features until regenerated.
        const localVersion = readLocalGeneratorVersion(outputDir)
        const cliVersion = getGeneratorVersion()
        if (
            !options.silent &&
            localVersion &&
            cliVersion &&
            localVersion !== cliVersion
        ) {
            console.warn(
                `Warning: generated client was produced by strapi-typed-client v${localVersion}, ` +
                    `but the installed CLI is v${cliVersion}.\n` +
                    `Run 'strapi-types generate' to refresh.`,
            )
        }

        // Create API client
        const client = createApiClient({
            url: options.url,
            token: options.token,
        })

        // Fetch remote hash
        if (!options.silent) {
            console.log(
                `Checking schema hash from ${options.url || process.env.STRAPI_URL || 'http://localhost:1337'}...`,
            )
        }

        const { hash: remoteHash } = await client.getSchemaHash()

        // Compare hashes
        const inSync = localHash === remoteHash

        if (!options.silent) {
            if (inSync) {
                console.log(
                    `Types are in sync (hash: ${localHash.substring(0, 8)}...)`,
                )
            } else {
                console.log(`Types are out of sync!`)
                console.log(`  Local:  ${localHash.substring(0, 8)}...`)
                console.log(`  Remote: ${remoteHash.substring(0, 8)}...`)
            }
        }

        return {
            inSync,
            localHash,
            remoteHash,
        }
    } catch (error) {
        return {
            inSync: false,
            localHash: null,
            remoteHash: null,
            error: (error as Error).message,
        }
    }
}

interface CheckCliOptions {
    url?: string
    token?: string
    output?: string
    silent?: boolean
}

/**
 * CLI handler for check command
 */
export function createCheckCommand(program: Command): void {
    program
        .command('check')
        .description(
            'Check if local types are in sync with remote Strapi schema',
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
            'Output directory to check (required) — where you generated, e.g. ./src/strapi',
        )
        .option('-s, --silent', 'Suppress output messages')
        .action(async (opts: CheckCliOptions) => {
            const result = await check({
                url: opts.url,
                token: opts.token,
                output: opts.output,
                silent: opts.silent,
            })

            if (result.error) {
                console.error('Check failed:', result.error)
                process.exit(1)
            }

            if (!result.inSync) {
                if (!opts.silent) {
                    console.log(
                        "\nRun 'strapi-types generate' to update types.",
                    )
                }
                process.exit(1)
            }

            process.exit(0)
        })
}
