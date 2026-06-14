import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
    readLocalSchemaHash,
    readLocalGeneratorVersion,
} from '../../../src/cli/utils/file-writer.js'

describe('file-writer header readers', () => {
    let dir: string

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-fw-'))
        fs.writeFileSync(
            path.join(dir, 'client.ts'),
            [
                '/* eslint-disable */',
                'export const SCHEMA_HASH = "deadbeef"',
                'export const GENERATOR_VERSION = "1.5.2"',
                'export class StrapiClient {}',
            ].join('\n'),
            'utf-8',
        )
    })

    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

    it('reads SCHEMA_HASH from the client header', () => {
        expect(readLocalSchemaHash(dir)).toBe('deadbeef')
    })

    it('reads GENERATOR_VERSION from the client header', () => {
        expect(readLocalGeneratorVersion(dir)).toBe('1.5.2')
    })

    it('returns null when there is no generated client', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-fw-empty-'))
        try {
            expect(readLocalSchemaHash(empty)).toBeNull()
            expect(readLocalGeneratorVersion(empty)).toBeNull()
        } finally {
            fs.rmSync(empty, { recursive: true, force: true })
        }
    })

    it('returns null for GENERATOR_VERSION when absent (pre-stamping clients)', () => {
        const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-fw-old-'))
        try {
            fs.writeFileSync(
                path.join(legacy, 'client.js'),
                'export const SCHEMA_HASH = "abc"\nexport class StrapiClient {}',
                'utf-8',
            )
            expect(readLocalSchemaHash(legacy)).toBe('abc')
            expect(readLocalGeneratorVersion(legacy)).toBeNull()
        } finally {
            fs.rmSync(legacy, { recursive: true, force: true })
        }
    })
})
