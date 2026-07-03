import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
    readLocalSchemaHash,
    readLocalGeneratorVersion,
    requireOutputDir,
    isInsideNodeModules,
    assertOutputDirForFormat,
} from '../../../src/cli/utils/file-writer.js'

describe('requireOutputDir', () => {
    it('returns the path when an output dir is given', () => {
        expect(requireOutputDir('./src/strapi')).toBe('./src/strapi')
    })

    it('trims surrounding whitespace from the returned path', () => {
        expect(requireOutputDir('  ./src/strapi  ')).toBe('./src/strapi')
    })

    it('throws an actionable error when output is missing', () => {
        expect(() => requireOutputDir(undefined)).toThrow(
            /No output directory specified/,
        )
        expect(() => requireOutputDir(undefined)).toThrow(/--output/)
    })

    it('throws on an empty / whitespace output', () => {
        expect(() => requireOutputDir('')).toThrow(
            /No output directory specified/,
        )
        expect(() => requireOutputDir('   ')).toThrow(
            /No output directory specified/,
        )
    })
})

describe('isInsideNodeModules', () => {
    it('detects a node_modules segment in relative and absolute paths', () => {
        expect(isInsideNodeModules('node_modules/strapi-typed-client')).toBe(
            true,
        )
        expect(isInsideNodeModules('./node_modules/x/dist')).toBe(true)
        expect(isInsideNodeModules('/repo/node_modules/x/dist')).toBe(true)
    })

    it('is false for source-tree paths', () => {
        expect(isInsideNodeModules('./src/strapi')).toBe(false)
        expect(isInsideNodeModules('/repo/src/strapi')).toBe(false)
    })
})

describe('assertOutputDirForFormat', () => {
    it('throws for --format ts inside node_modules', () => {
        expect(() =>
            assertOutputDirForFormat('./node_modules/x/dist', 'ts'),
        ).toThrow(/--format ts cannot write into node_modules/)
    })

    it('allows js output inside node_modules (nudge only)', () => {
        expect(() =>
            assertOutputDirForFormat('./node_modules/x/dist', 'js'),
        ).not.toThrow()
    })

    it('allows ts output in the source tree', () => {
        expect(() =>
            assertOutputDirForFormat('./src/strapi', 'ts'),
        ).not.toThrow()
    })
})

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
