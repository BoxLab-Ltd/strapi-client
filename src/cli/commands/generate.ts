/**
 * Generate command - generates TypeScript types from Strapi schema
 */

import * as fs from 'fs'
import * as path from 'path'
import { createApiClient } from '../utils/api-client.js'
import {
    readLocalSchemaHash,
    getDefaultOutputDir,
} from '../utils/file-writer.js'
import { Generator } from '../../generator/index.js'
import { transformSchema } from '../../core/schema-transformer.js'
import { getGeneratorVersion } from '../../shared/version.js'

export interface GenerateOptions {
    url?: string
    token?: string
    output?: string
    silent?: boolean
    force?: boolean
    format?: 'js' | 'ts'
}

/**
 * Output that lands inside node_modules is ephemeral — a reinstall wipes it,
 * so the types must be regenerated. Used to bar `--format ts` from it and to
 * nudge `--format js` users toward a durable, committable output directory.
 */
function isInsideNodeModules(outputDir: string): boolean {
    return path.resolve(outputDir).split(path.sep).includes('node_modules')
}

/**
 * Shipping raw .ts into node_modules breaks at runtime: Node can't require
 * .ts files and the package.json exports still point at the missing .js.
 * Force consumers to pick a source-tree output instead.
 */
function assertOutputDirForFormat(
    outputDir: string,
    format: 'js' | 'ts',
): void {
    if (format !== 'ts') return
    if (isInsideNodeModules(outputDir)) {
        throw new Error(
            `--format ts cannot write into node_modules (${outputDir}). ` +
                `Point --output at your source tree (e.g. ./src/strapi).`,
        )
    }
}

const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`

export interface GenerateResult {
    success: boolean
    filesWritten: string[]
    hash?: string
    error?: string
    skipped?: boolean
}

/**
 * Generate types from Strapi API
 */
export async function generate(
    options: GenerateOptions,
): Promise<GenerateResult> {
    const outputDir = options.output || getDefaultOutputDir()
    const format: 'js' | 'ts' = options.format ?? 'js'
    const filesWritten: string[] = []

    try {
        assertOutputDirForFormat(outputDir, format)

        // Create API client
        const client = createApiClient({
            url: options.url,
            token: options.token,
        })

        const baseUrl =
            options.url || process.env.STRAPI_URL || 'http://localhost:1337'

        // Check if we need to regenerate (compare hashes)
        if (!options.force) {
            const localHash = readLocalSchemaHash(outputDir)

            // Verify generated files actually exist (they may be lost after package update)
            const generatedFiles = (
                format === 'ts'
                    ? ['types.ts', 'client.ts', 'index.ts']
                    : ['types.d.ts', 'client.d.ts', 'index.d.ts']
            ).map(f => path.join(outputDir, f))
            const allFilesExist = generatedFiles.every(f => fs.existsSync(f))

            if (localHash && allFilesExist) {
                if (!options.silent) {
                    console.log('Checking schema hash...')
                }

                try {
                    const { hash: remoteHash } = await client.getSchemaHash()

                    if (localHash === remoteHash) {
                        if (!options.silent) {
                            console.log(
                                `Types are up to date (hash: ${localHash.substring(0, 8)}...)`,
                            )
                        }
                        return {
                            success: true,
                            filesWritten: [],
                            hash: localHash,
                            skipped: true,
                        }
                    }

                    if (!options.silent) {
                        console.log(
                            `Schema changed (${localHash.substring(0, 8)}... -> ${remoteHash.substring(0, 8)}...)`,
                        )
                    }
                } catch {
                    // If hash check fails, continue with full generation
                    if (!options.silent) {
                        console.log(
                            'Could not check remote hash, regenerating...',
                        )
                    }
                }
            } else if (localHash && !allFilesExist) {
                if (!options.silent) {
                    console.log(
                        'Generated files missing (package may have been updated), regenerating...',
                    )
                }
            }
        }

        // Fetch schema from Strapi
        if (!options.silent) {
            console.log(`Fetching schema from ${baseUrl}...`)
        }

        const {
            schema,
            endpoints: apiEndpoints,
            pluginEndpoints,
            extraTypes,
            hash,
        } = await client.getSchema()

        // Merge API and plugin endpoints for generation
        const endpoints = [...(apiEndpoints || []), ...(pluginEndpoints || [])]

        if (!options.silent) {
            console.log(
                `  Content types: ${Object.keys(schema.contentTypes).length}`,
            )
            console.log(
                `  Components: ${Object.keys(schema.components).length}`,
            )
            if (endpoints && endpoints.length > 0) {
                console.log(`  Custom endpoints: ${endpoints.length}`)
            }
            if (extraTypes && extraTypes.length > 0) {
                console.log(`  Extra types: ${extraTypes.length}`)
            }
        }

        // Transform JSON schema to ParsedSchema format
        const parsedSchema = transformSchema(schema)

        // Generate types
        if (!options.silent) {
            console.log('Generating TypeScript types...')
        }

        const generator = new Generator(outputDir)
        await generator.generate(
            parsedSchema,
            endpoints,
            extraTypes,
            hash,
            getGeneratorVersion(),
            format,
        )

        // Track generated files
        const emittedFiles =
            format === 'ts'
                ? ['types.ts', 'client.ts', 'index.ts']
                : [
                      'types.js',
                      'types.d.ts',
                      'client.js',
                      'client.d.ts',
                      'index.js',
                      'index.d.ts',
                  ]
        for (const f of emittedFiles) {
            filesWritten.push(path.join(outputDir, f))
        }

        if (!options.silent && isInsideNodeModules(outputDir)) {
            console.log(
                dim(
                    'Types written into node_modules — a reinstall wipes them.\n' +
                        'For durable, reviewable types, generate into your source tree and commit it:\n' +
                        '  strapi-types generate --output ./src/strapi',
                ),
            )
        }

        return {
            success: true,
            filesWritten,
            hash,
        }
    } catch (error) {
        return {
            success: false,
            filesWritten,
            error: (error as Error).message,
        }
    }
}

interface GenerateCliOptions {
    url?: string
    token?: string
    output?: string
    silent?: boolean
    force?: boolean
    format?: string
}

/**
 * CLI handler for generate command
 */
export function createGenerateCommand(program: {
    command: (...args: any[]) => any
}): void {
    program
        .command('generate')
        .description('Generate TypeScript types from Strapi schema')
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
            'Output directory (default: node_modules/strapi-typed-client/dist)',
        )
        .option('-s, --silent', 'Suppress output messages')
        .option('-f, --force', 'Force regeneration even if schema unchanged')
        .option(
            '--format <js|ts>',
            'Output format: js (compiled .js + .d.ts, default) or ts (raw .ts for monorepo/source-tree output)',
            'js',
        )
        .action(async (opts: GenerateCliOptions) => {
            if (opts.format && opts.format !== 'js' && opts.format !== 'ts') {
                console.error(
                    `Invalid --format value: ${opts.format}. Expected 'js' or 'ts'.`,
                )
                process.exit(1)
            }

            const result = await generate({
                url: opts.url,
                token: opts.token,
                output: opts.output,
                silent: opts.silent,
                force: opts.force,
                format: opts.format as 'js' | 'ts' | undefined,
            })

            if (!result.success) {
                console.error('Generation failed:', result.error)
                process.exit(1)
            }

            if (!opts.silent && !result.skipped) {
                console.log('Generation complete!')
                if (result.hash) {
                    console.log(
                        `Schema hash: ${result.hash.substring(0, 8)}...`,
                    )
                }
            }
        })
}
