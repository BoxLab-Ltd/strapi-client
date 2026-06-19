import { describe, it, expect } from 'vitest'
import { PluginApiGenerator } from '../../../src/generator/plugin-api-generator.js'

const generator = new PluginApiGenerator()
const output = generator.generateAllPluginClasses()

describe('PluginApiGenerator', () => {
    describe('UploadAPI class structure', () => {
        it('emits a class extending BaseAPI', () => {
            expect(output).toContain('class UploadAPI extends BaseAPI {')
        })

        it('has a constructor that calls super(config)', () => {
            expect(output).toContain('constructor(config: StrapiClientConfig)')
            expect(output).toContain('super(config)')
        })

        it('emits the plugin-name comment', () => {
            expect(output).toContain('// API for "upload" plugin')
        })
    })

    describe('upload() method', () => {
        it('has correct signature with FormData body', () => {
            expect(output).toContain(
                'async upload(body: FormData, nextOptions?: NextOptions): Promise<MediaFile[]>',
            )
        })

        it('uses POST /api/upload as URL', () => {
            expect(output).toContain('`${this.config.baseURL}/api/upload`')
        })

        it("passes 'Strapi Upload' as errorPrefix to request()", () => {
            // The method calls this.request<MediaFile[]>(url, ..., 'Strapi Upload')
            const segment = output.slice(output.indexOf('async upload('))
            expect(segment).toMatch(/'Strapi Upload'/)
        })

        it('passes FormData body without JSON.stringify', () => {
            const segment = output.slice(
                output.indexOf('async upload('),
                output.indexOf('async find('),
            )
            expect(segment).toContain("method: 'POST'")
            expect(segment).toContain('body }')
            expect(segment).not.toContain('JSON.stringify(body)')
        })
    })

    describe('find() method', () => {
        it('has correct signature with UploadQueryParams', () => {
            expect(output).toContain(
                'async find(params?: UploadQueryParams, nextOptions?: NextOptions): Promise<MediaFile[]>',
            )
        })

        it('builds a query string and appends it to URL', () => {
            const segment = output.slice(
                output.indexOf('async find('),
                output.indexOf('async findOne('),
            )
            expect(segment).toContain('this.buildQueryString(params)')
            expect(segment).toContain(
                '`${this.config.baseURL}/api/upload/files${query}`',
            )
        })

        it('uses GET (no method: option in request body)', () => {
            const segment = output.slice(
                output.indexOf('async find('),
                output.indexOf('async findOne('),
            )
            expect(segment).toContain('this.request<MediaFile[]>(url, {}')
        })
    })

    describe('findOne() method', () => {
        it('has correct signature with id: number', () => {
            expect(output).toContain(
                'async findOne(id: number, nextOptions?: NextOptions): Promise<MediaFile>',
            )
        })

        it('interpolates id into the URL', () => {
            expect(output).toContain(
                '`${this.config.baseURL}/api/upload/files/${id}`',
            )
        })
    })

    describe('delete() method', () => {
        it('has correct signature with id: number returning MediaFile', () => {
            expect(output).toContain(
                'async delete(id: number, nextOptions?: NextOptions): Promise<MediaFile>',
            )
        })

        it('uses DELETE method', () => {
            const segment = output.slice(output.indexOf('async delete('))
            expect(segment).toContain("method: 'DELETE'")
        })

        it('does not include a body parameter', () => {
            const sig = output.slice(
                output.indexOf('async delete('),
                output.indexOf(')', output.indexOf('async delete(')) + 1,
            )
            expect(sig).not.toContain('body:')
        })
    })

    describe('destroy() deprecated alias', () => {
        it('keeps a @deprecated destroy() that delegates to delete()', () => {
            const idx = output.indexOf('async destroy(')
            expect(idx).toBeGreaterThan(-1)
            expect(output.slice(0, idx)).toMatch(/@deprecated[^]*?delete\(\)/)
            expect(output).toContain(
                'async destroy(id: number, nextOptions?: NextOptions): Promise<MediaFile>',
            )
            const body = output.slice(idx)
            expect(body).toContain('return this.delete(id, nextOptions)')
        })
    })

    describe('JSDoc comments', () => {
        it('includes the route as a JSDoc line for each method', () => {
            expect(output).toContain('POST /api/upload')
            expect(output).toContain('GET /api/upload/files')
            expect(output).toContain('GET /api/upload/files/:id')
            expect(output).toContain('DELETE /api/upload/files/:id')
        })

        it('includes the description text', () => {
            expect(output).toContain(
                'Upload one or more files. Pass FormData with field "files".',
            )
            expect(output).toContain(
                'List uploaded files. Supports filters/sort and flat start/limit pagination.',
            )
            expect(output).toContain(
                'Get a single uploaded file by numeric id.',
            )
            expect(output).toContain(
                'Delete an uploaded file by numeric id. Returns the deleted file.',
            )
        })
    })
})
