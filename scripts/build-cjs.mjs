/**
 * Finish the CommonJS build of the plugin server.
 *
 * Strapi loads a plugin through require() and picks the entrypoint from the
 * "require" export condition, then decides how to read it by file EXTENSION:
 * .js is required, .json is parsed, anything else — .cjs included — silently
 * yields an empty plugin. So the entrypoint has to stay a .js file that Node
 * treats as CommonJS, which is what the type marker written here does for the
 * whole dist/cjs subtree.
 */

import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const outDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'dist',
    'cjs',
)

mkdirSync(outDir, { recursive: true })

writeFileSync(
    path.join(outDir, 'package.json'),
    `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`,
)

writeFileSync(
    path.join(outDir, 'strapi-server.js'),
    [
        "'use strict'",
        '',
        "module.exports = require('./plugin/server/src/index.js').default",
        '',
    ].join('\n'),
)
