/**
 * Resolve the installed generator (package) version from the package's own
 * package.json, so the value matches the published version exactly. Node-only
 * helper — do not import from the shared barrel (keeps fs out of browser bundles).
 *
 * @module shared/version
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import * as path from 'path'

let cached: string | undefined

export function getGeneratorVersion(): string {
    if (cached !== undefined) return cached
    let version = ''
    try {
        const dir = path.dirname(fileURLToPath(import.meta.url))
        const pkg = JSON.parse(
            readFileSync(path.join(dir, '../../package.json'), 'utf-8'),
        )
        if (typeof pkg.version === 'string') version = pkg.version
    } catch {
        // ignore — fall back to empty version
    }
    cached = version
    return version
}
