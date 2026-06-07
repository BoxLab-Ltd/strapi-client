/**
 * File writer utilities for CLI output
 */

import * as fs from 'fs'
import { createRequire } from 'module'
import * as path from 'path'

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
 * Resolve default output directory: package dist/ in node_modules.
 * Falls back to ./dist when the package can't be resolved (e.g. local dev).
 */
export function getDefaultOutputDir(): string {
    try {
        const _require = createRequire(
            path.resolve(process.cwd(), 'package.json'),
        )
        const pkgJsonPath = _require.resolve('strapi-typed-client/package.json')
        return path.join(path.dirname(pkgJsonPath), 'dist')
    } catch {
        return './dist'
    }
}

const HEADER_HEAD_BYTES = 512

/**
 * Read the first N bytes of a file without loading the whole thing.
 * SCHEMA_HASH is emitted at the top of client.ts/client.js so this is enough.
 */
function readFileHead(filePath: string, bytes: number): string | null {
    let fd: number | undefined
    try {
        fd = fs.openSync(filePath, 'r')
        const buf = Buffer.alloc(bytes)
        const read = fs.readSync(fd, buf, 0, bytes, 0)
        return buf.slice(0, read).toString('utf-8')
    } catch {
        return null
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

/**
 * Read schema hash from the generated client. Tries client.ts (raw, .ts mode)
 * first, then client.js (compiled, .js mode). SCHEMA_HASH is baked into the
 * client at generation time as the first export — reading the file head is
 * enough and avoids parsing the full client.
 */
export function readLocalSchemaHash(outputDir: string): string | null {
    return readLocalHeaderConst(outputDir, 'SCHEMA_HASH')
}

/**
 * Read the GENERATOR_VERSION baked into the generated client at generation
 * time. Used to detect when committed types drift from the installed CLI
 * version. Returns null when not generated or the constant is absent (e.g.
 * clients generated before version stamping was introduced).
 */
export function readLocalGeneratorVersion(outputDir: string): string | null {
    return readLocalHeaderConst(outputDir, 'GENERATOR_VERSION')
}

/**
 * Read a `export const <NAME> = '<value>'` baked into the generated client
 * header. Both SCHEMA_HASH and GENERATOR_VERSION live in the first bytes of
 * client.ts/client.js, so reading the head is enough.
 */
function readLocalHeaderConst(outputDir: string, name: string): string | null {
    const re = new RegExp(`${name}\\s*=\\s*['"]([^'"]*)['"]`)
    for (const file of ['client.ts', 'client.js']) {
        const head = readFileHead(path.join(outputDir, file), HEADER_HEAD_BYTES)
        if (!head) continue
        const match = head.match(re)
        if (match) return match[1]
    }
    return null
}
