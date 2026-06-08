import { describe, it, expect } from 'vitest'
import { isGeneratedOutputFresh } from '../../../src/cli/commands/generate.js'

describe('isGeneratedOutputFresh', () => {
    const base = {
        localHash: 'abc',
        remoteHash: 'abc',
        localVersion: '1.6.0',
        cliVersion: '1.6.0',
        allFilesExist: true,
    }

    it('is fresh when hash and generator version both match', () => {
        expect(isGeneratedOutputFresh(base)).toBe(true)
    })

    it('is stale when the generator version differs (package upgraded)', () => {
        expect(isGeneratedOutputFresh({ ...base, localVersion: '1.5.3' })).toBe(
            false,
        )
    })

    it('is stale when the schema hash differs', () => {
        expect(isGeneratedOutputFresh({ ...base, remoteHash: 'xyz' })).toBe(
            false,
        )
    })

    it('is stale when no local hash or files are missing', () => {
        expect(isGeneratedOutputFresh({ ...base, localHash: null })).toBe(false)
        expect(isGeneratedOutputFresh({ ...base, allFilesExist: false })).toBe(
            false,
        )
    })
})
