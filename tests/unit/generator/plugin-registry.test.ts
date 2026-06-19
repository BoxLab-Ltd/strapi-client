import { describe, it, expect } from 'vitest'
import { PLUGIN_REGISTRY } from '../../../src/generator/plugin-registry.js'

describe('PLUGIN_REGISTRY', () => {
    it('exports a non-empty array', () => {
        expect(Array.isArray(PLUGIN_REGISTRY)).toBe(true)
        expect(PLUGIN_REGISTRY.length).toBeGreaterThan(0)
    })

    describe('upload contract', () => {
        const upload = PLUGIN_REGISTRY.find(c => c.pluginName === 'upload')

        it('exists', () => {
            expect(upload).toBeDefined()
        })

        it('has clientProperty "upload" and className "UploadAPI"', () => {
            expect(upload?.clientProperty).toBe('upload')
            expect(upload?.className).toBe('UploadAPI')
        })

        it('has errorPrefix "Strapi Upload"', () => {
            expect(upload?.errorPrefix).toBe('Strapi Upload')
        })

        it('has 4 endpoints (upload, find, findOne, delete)', () => {
            expect(upload?.endpoints).toHaveLength(4)
            const names = upload?.endpoints.map(e => e.methodName)
            expect(names).toEqual(['upload', 'find', 'findOne', 'delete'])
        })

        it('upload endpoint is POST /upload with FormData body and MediaFile[] response', () => {
            const ep = upload?.endpoints.find(e => e.methodName === 'upload')
            expect(ep?.method).toBe('POST')
            expect(ep?.path).toBe('/upload')
            expect(ep?.bodyType).toBe('FormData')
            expect(ep?.responseType).toBe('MediaFile[]')
        })

        it('find endpoint is GET /upload/files with UploadQueryParams', () => {
            const ep = upload?.endpoints.find(e => e.methodName === 'find')
            expect(ep?.method).toBe('GET')
            expect(ep?.path).toBe('/upload/files')
            // Upload plugin uses flat start/limit, not pagination[page] —
            // dedicated UploadQueryParams type reflects that.
            expect(ep?.queryType).toBe('UploadQueryParams')
            expect(ep?.responseType).toBe('MediaFile[]')
        })

        it('findOne endpoint is GET /upload/files/:id with id: number', () => {
            const ep = upload?.endpoints.find(e => e.methodName === 'findOne')
            expect(ep?.method).toBe('GET')
            expect(ep?.path).toBe('/upload/files/:id')
            expect(ep?.paramTypes).toEqual({ id: 'number' })
            expect(ep?.responseType).toBe('MediaFile')
        })

        it('delete endpoint is DELETE /upload/files/:id with id: number (keeps destroy alias)', () => {
            const ep = upload?.endpoints.find(e => e.methodName === 'delete')
            expect(ep?.method).toBe('DELETE')
            expect(ep?.path).toBe('/upload/files/:id')
            expect(ep?.paramTypes).toEqual({ id: 'number' })
            expect(ep?.responseType).toBe('MediaFile')
            expect(ep?.deprecatedAlias).toBe('destroy')
        })
    })
})
