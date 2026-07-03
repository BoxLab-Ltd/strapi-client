/**
 * File writer utilities for CLI output
 */

import * as fs from 'fs'
import * as path from 'path'
import { readClientHeaderConst } from '../../shared/client-header.js'

export interface WriteResult {
    path: string
    success: boolean
    error?: Error
}

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

/**
 * Write content to a file
 */
export function writeFile(filePath: string, content: string): WriteResult {
    try {
        ensureDir(path.dirname(filePath))
        // codeql[js/http-to-file-access] - Generated TypeScript code from parsed Strapi schema, not raw network data
        fs.writeFileSync(filePath, content, 'utf-8')
        return { path: filePath, success: true }
    } catch (error) {
        return { path: filePath, success: false, error: error as Error }
    }
}

/**
 * Read content from a file
 */
export function readFile(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf-8')
    } catch {
        return null
    }
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath)
}

/**
 * Write multiple files. Reports all results even if some fail.
 */
export function writeFiles(
    files: Array<{ path: string; content: string }>,
): WriteResult[] {
    const results: WriteResult[] = []

    for (const file of files) {
        const result = writeFile(file.path, file.content)
        results.push(result)

        if (!result.success) {
            console.error(
                `Failed to write ${file.path}:`,
                result.error?.message,
            )
        }
    }

    return results
}

/**
 * Output that lands inside node_modules is ephemeral — a reinstall wipes it,
 * so the types must be regenerated. Used to bar `--format ts` from it and to
 * nudge `--format js` users toward a durable, committable output directory.
 */
export function isInsideNodeModules(outputDir: string): boolean {
    return path.resolve(outputDir).split(path.sep).includes('node_modules')
}

/**
 * Shipping raw .ts into node_modules breaks at runtime: Node can't require
 * .ts files and the package.json exports still point at the missing .js.
 * Force consumers to pick a source-tree output instead.
 */
export function assertOutputDirForFormat(
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

/**
 * Require an explicit output directory. The generated client is meant to be
 * written into your source tree and committed — there is no implicit
 * node_modules default (a reinstall would wipe it). Throws an actionable error
 * when no output was given, so both the CLI and programmatic callers fail loudly
 * instead of silently writing somewhere unexpected.
 */
export function requireOutputDir(output: string | undefined): string {
    if (!output || !output.trim()) {
        throw new Error(
            'No output directory specified.\n' +
                'Pass --output pointing at your source tree, e.g.:\n' +
                '  strapi-types generate --output ./src/strapi --format ts\n' +
                'Generated code is meant to be committed to your repo, not written into node_modules.',
        )
    }
    return output.trim()
}

/**
 * Read schema hash from the generated client. SCHEMA_HASH is baked into the
 * client at generation time as the first export.
 */
export function readLocalSchemaHash(outputDir: string): string | null {
    return readClientHeaderConst(outputDir, 'SCHEMA_HASH')
}

/**
 * Read the GENERATOR_VERSION baked into the generated client at generation
 * time. Used to detect when committed types drift from the installed CLI
 * version. Returns null when not generated or the constant is absent (e.g.
 * clients generated before version stamping was introduced).
 */
export function readLocalGeneratorVersion(outputDir: string): string | null {
    return readClientHeaderConst(outputDir, 'GENERATOR_VERSION')
}
