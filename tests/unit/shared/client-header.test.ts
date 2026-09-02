import { describe, it, expect, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
    detectOutputFormat,
    hasMixedFormatOutput,
} from '../../../src/shared/client-header.js'

const dirs: string[] = []

function outputDirWith(...files: string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-fmt-'))
    dirs.push(dir)
    for (const file of files) {
        fs.writeFileSync(path.join(dir, file), '/* generated */', 'utf-8')
    }
    return dir
}

afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
})

describe('detectOutputFormat', () => {
    it('reports ts for a raw .ts output tree', () => {
        expect(detectOutputFormat(outputDirWith('client.ts', 'types.ts'))).toBe(
            'ts',
        )
    })

    it('reports js for a compiled output tree', () => {
        expect(
            detectOutputFormat(outputDirWith('client.js', 'client.d.ts')),
        ).toBe('js')
    })

    it('prefers ts in a mixed tree — the shape a wrong-format run leaves behind', () => {
        expect(
            detectOutputFormat(
                outputDirWith('client.ts', 'client.js', 'client.d.ts'),
            ),
        ).toBe('ts')
    })

    it('returns null when nothing has been generated yet', () => {
        expect(detectOutputFormat(outputDirWith())).toBeNull()
    })

    it('returns null for a directory that does not exist', () => {
        expect(
            detectOutputFormat('/nope/strapi-typed-client/missing'),
        ).toBeNull()
    })
})

describe('hasMixedFormatOutput', () => {
    it('is true only when both clients sit side by side', () => {
        expect(
            hasMixedFormatOutput(outputDirWith('client.ts', 'client.js')),
        ).toBe(true)
        expect(hasMixedFormatOutput(outputDirWith('client.ts'))).toBe(false)
        expect(hasMixedFormatOutput(outputDirWith('client.js'))).toBe(false)
        expect(hasMixedFormatOutput(outputDirWith())).toBe(false)
    })
})
