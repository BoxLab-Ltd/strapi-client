/**
 * Read a constant baked into the generated client header — SCHEMA_HASH and
 * GENERATOR_VERSION are emitted as the first exports of client.ts/client.js, so
 * reading the file head is enough and avoids parsing the whole client.
 *
 * Node-only (uses `fs`). Shared by the CLI file-writer and the Next.js plugin
 * so the two readers can't drift. Do NOT re-export from the shared barrel —
 * keep `fs` out of any browser bundle (same rule as `shared/version`).
 *
 * @module shared/client-header
 */

import * as fs from 'fs'
import * as path from 'path'

const HEADER_HEAD_BYTES = 512

// .ts first: it is the source in ts mode, so it also wins a tree holding both.
const CLIENT_FILES = ['client.ts', 'client.js'] as const

/**
 * Read the first N bytes of a file without loading the whole thing.
 */
function readFileHead(filePath: string, bytes: number): string | null {
    let fd: number | undefined
    try {
        fd = fs.openSync(filePath, 'r')
        const buf = Buffer.alloc(bytes)
        const read = fs.readSync(fd, buf, 0, bytes, 0)
        return buf.subarray(0, read).toString('utf-8')
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
 * Read a `export const <NAME> = '<value>'` baked into the generated client
 * header. Tries client.ts (raw, .ts mode) first, then client.js (compiled, .js
 * mode). Returns null when not generated or the constant is absent (e.g. a
 * client produced before that constant was stamped).
 */
export function readClientHeaderConst(
    outputDir: string,
    name: string,
): string | null {
    const re = new RegExp(`${name}\\s*=\\s*['"]([^'"]*)['"]`)
    for (const file of CLIENT_FILES) {
        const head = readFileHead(path.join(outputDir, file), HEADER_HEAD_BYTES)
        if (!head) continue
        const match = head.match(re)
        if (match) return match[1]
    }
    return null
}

/**
 * Infer the format from output that was already generated, so a regeneration
 * keeps whatever the committed tree uses. Writing .js beside stale .ts sources
 * leaves those sources winning the hash lookup above, so the mismatch repeats
 * on every later run instead of settling. Null when nothing is generated yet.
 */
export function detectOutputFormat(outputDir: string): 'js' | 'ts' | null {
    for (const file of CLIENT_FILES) {
        if (fs.existsSync(path.join(outputDir, file))) {
            return file.endsWith('.ts') ? 'ts' : 'js'
        }
    }
    return null
}

/**
 * True when both formats sit side by side — only a wrong-format regeneration
 * leaves that behind, and half of those files are stale from then on.
 */
export function hasMixedFormatOutput(outputDir: string): boolean {
    return CLIENT_FILES.every(file => fs.existsSync(path.join(outputDir, file)))
}
