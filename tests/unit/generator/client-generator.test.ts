import { describe, it, expect, vi, afterEach } from 'vitest'
import { ClientGenerator } from '../../../src/generator/client-generator.js'
import type { ParsedSchema } from '../../../src/schema-types.js'
import type { ParsedEndpoint } from '../../../src/shared/endpoint-types.js'

const mockSchema: ParsedSchema = {
    contentTypes: [
        {
            name: 'ApiItemItem',
            cleanName: 'Item',
            collectionName: 'items',
            singularName: 'item',
            pluralName: 'items',
            kind: 'collection',
            attributes: [
                { name: 'title', type: { kind: 'string' }, required: true },
                { name: 'price', type: { kind: 'integer' }, required: false },
            ],
            relations: [
                {
                    name: 'category',
                    relationType: 'manyToOne',
                    target: 'api::category.category',
                    targetType: 'Category',
                    required: false,
                },
            ],
            media: [{ name: 'image', multiple: false, required: false }],
            components: [],
            dynamicZones: [],
        },
        {
            name: 'ApiCategoryCategory',
            cleanName: 'Category',
            collectionName: 'categories',
            singularName: 'category',
            pluralName: 'categories',
            kind: 'collection',
            attributes: [
                { name: 'name', type: { kind: 'string' }, required: true },
            ],
            relations: [],
            media: [],
            components: [],
            dynamicZones: [],
        },
        {
            name: 'PluginUsersPermissionsUser',
            cleanName: 'User',
            collectionName: 'up_users',
            singularName: 'user',
            pluralName: 'users',
            kind: 'collection',
            attributes: [
                { name: 'email', type: { kind: 'string' }, required: true },
                { name: 'username', type: { kind: 'string' }, required: true },
            ],
            relations: [],
            media: [{ name: 'avatar', multiple: false, required: false }],
            components: [],
            dynamicZones: [],
        },
        {
            name: 'ApiHomepageHomepage',
            cleanName: 'Homepage',
            collectionName: 'homepages',
            singularName: 'homepage',
            pluralName: 'homepages',
            kind: 'single',
            attributes: [
                { name: 'heading', type: { kind: 'string' }, required: true },
            ],
            relations: [],
            media: [{ name: 'banner', multiple: false, required: false }],
            components: [],
            dynamicZones: [],
        },
    ],
    components: [],
}

describe('ClientGenerator', () => {
    const generator = new ClientGenerator()
    const output = generator.generate(mockSchema)

    describe('Header constants', () => {
        it('bakes SCHEMA_HASH and GENERATOR_VERSION into the header', () => {
            const out = new ClientGenerator().generate(
                mockSchema,
                undefined,
                undefined,
                'abc123',
                '9.9.9',
            )
            expect(out).toContain('export const SCHEMA_HASH = "abc123"')
            expect(out).toContain('export const GENERATOR_VERSION = "9.9.9"')
        })

        it('defaults header constants to empty strings', () => {
            expect(output).toContain('export const SCHEMA_HASH = ""')
            expect(output).toContain('export const GENERATOR_VERSION = ""')
        })
    })

    describe('Imports', () => {
        it('should import content types from types.js', () => {
            expect(output).toContain("from './types.js'")
            expect(output).toContain('Item')
            expect(output).toContain('Category')
            expect(output).toContain('User')
            expect(output).toContain('Homepage')
        })
        it('should import GetPayload types for types with populatable fields', () => {
            expect(output).toContain('ItemGetPayload')
            expect(output).toContain('UserGetPayload')
            expect(output).toContain('HomepageGetPayload')
            expect(output).not.toContain('CategoryGetPayload')
        })
        it('should import PopulateParam types for types with populatable fields', () => {
            expect(output).toContain('ItemPopulateParam')
            expect(output).toContain('UserPopulateParam')
            expect(output).toContain('HomepagePopulateParam')
            expect(output).not.toContain('CategoryPopulateParam')
        })
        it('should import Input types', () => {
            expect(output).toContain('ItemInput')
            expect(output).toContain('CategoryInput')
            expect(output).toContain('UserInput')
            expect(output).toContain('HomepageInput')
        })
        it('should import Filter types', () => {
            expect(output).toContain('ItemFilters')
            expect(output).toContain('CategoryFilters')
            expect(output).toContain('UserFilters')
            expect(output).toContain('HomepageFilters')
        })
        it('should import MediaFile', () => {
            expect(output).toContain('MediaFile')
        })
    })

    describe('Utility types', () => {
        it('should generate StrapiResponse interface', () => {
            expect(output).toContain('export interface StrapiResponse<T>')
            expect(output).toContain('data: T')
            expect(output).toContain('pagination?')
        })
        it('should generate StrapiError class with errorName + unknown details', () => {
            expect(output).toContain('export class StrapiError extends Error')
            expect(output).toContain('userMessage: string')
            expect(output).toContain('status: number')
            expect(output).toContain('statusText: string')
            // details is now `unknown` (was `any`) — narrowed via isStrapiErrorOf
            expect(output).toContain('details?: unknown')
            // discriminator field for narrowing
            expect(output).toContain('errorName: StrapiErrorName')
            // Error.name remains "StrapiError" for sentry/sourcemap contracts
            expect(output).toContain('this.name = "StrapiError"')
            // constructor stores the new errorName
            expect(output).toContain('this.errorName = errorName')
        })

        it('should generate StrapiValidationIssue interface', () => {
            expect(output).toContain('export interface StrapiValidationIssue')
            expect(output).toContain('path: string[]')
            expect(output).toContain('message: string')
        })

        it('should generate StrapiErrorName union including known names + string fallback', () => {
            expect(output).toContain('export type StrapiErrorName')
            expect(output).toContain("'ValidationError'")
            expect(output).toContain("'PolicyError'")
            expect(output).toContain("'NotFoundError'")
            // string fallback for unknown plugin/future error names
            expect(output).toContain('(string & {})')
        })

        it('should generate StrapiErrorDetailsMap mapping known names to detail shapes', () => {
            expect(output).toContain('export type StrapiErrorDetailsMap')
            expect(output).toContain(
                'ValidationError: { errors: StrapiValidationIssue[] }',
            )
            expect(output).toContain(
                'PolicyError: { policy?: string; message?: string }',
            )
            // stateless errors map to undefined for cleaner DX
            expect(output).toContain('NotFoundError: undefined')
            expect(output).toContain('UnauthorizedError: undefined')
        })

        it('should generate UnknownStrapiErrorDetails interface for fallback', () => {
            expect(output).toContain(
                'export interface UnknownStrapiErrorDetails',
            )
            expect(output).toContain('errorName: string')
        })

        it('should generate isStrapiError and isStrapiErrorOf type guards', () => {
            expect(output).toContain(
                'export function isStrapiError(err: unknown): err is StrapiError',
            )
            expect(output).toContain(
                'export function isStrapiErrorOf<N extends keyof StrapiErrorDetailsMap>',
            )
            expect(output).toContain(
                'err is StrapiError & { errorName: N; details: StrapiErrorDetailsMap[N] }',
            )
        })

        it('should propagate Strapi-side error name into the StrapiError constructor', () => {
            expect(output).toContain(
                "errorData.error?.details,\n        errorData.error?.name ?? 'UnknownError'",
            )
            expect(output).toContain(
                "response.statusText,\n          undefined,\n          'UnknownError'",
            )
        })
        it('should generate StrapiConnectionError class', () => {
            expect(output).toContain(
                'export class StrapiConnectionError extends Error',
            )
            expect(output).toContain('url: string')
            expect(output).toContain('cause?: Error')
        })
        it('should generate BaseAPI class with request and buildQueryString methods', () => {
            expect(output).toContain('class BaseAPI')
            expect(output).toContain('protected async request<R>(')
            expect(output).toContain(
                'protected buildQueryString(params?: QueryParams): string',
            )
        })
        it('should wrap fetch in try-catch with StrapiConnectionError for network errors', () => {
            expect(output).toContain('throw new StrapiConnectionError(')
            expect(output).toContain('ECONNREFUSED')
            expect(output).toContain('Is the server running?')
            expect(output).toContain('ENOTFOUND')
            expect(output).toContain('Could not resolve host')
        })
        it('should detect HTML responses and throw StrapiError with helpful message', () => {
            expect(output).toContain('text/html')
            expect(output).toContain('Strapi returned HTML instead of JSON')
        })
        it('should include HTTP status hints for common error codes', () => {
            expect(output).toContain('getErrorHint')
            expect(output).toContain('check that your API token is valid')
            expect(output).toContain('your token may lack permissions')
            expect(output).toContain('this endpoint may not exist')
            expect(output).toContain('internal Strapi error')
        })
        it('should support timeout via AbortController', () => {
            expect(output).toContain('AbortController')
            expect(output).toContain('Request timed out after')
            expect(output).toContain('this.config.timeout')
        })
        it('should generate StrapiSortOption type excluding __typename', () => {
            expect(output).toContain(
                "type StrapiSortOption<T> = Exclude<keyof T & string, '__typename'>",
            )
        })
        it('should generate QueryParams with 4 generic parameters (TEntity, TFilters, TPopulate, TFields)', () => {
            expect(output).toContain(
                'export interface QueryParams<TEntity = any, TFilters = Record<string, any>, TPopulate = any, TFields extends string =',
            )
        })
        it('should generate QueryParams fields as TFields[]', () => {
            expect(output).toContain('fields?: TFields[]')
        })
        it('should generate QueryParams with locale parameter for i18n support', () => {
            expect(output).toContain('locale?: string')
        })
        it('should generate QueryParams with status parameter for publication state', () => {
            expect(output).toContain("status?: 'draft' | 'published'")
        })
        it('should generate UploadQueryParams with flat start/limit (not pagination)', () => {
            expect(output).toContain('export interface UploadQueryParams')
            expect(output).toContain('start?: number')
            expect(output).toContain('limit?: number')
            // upload plugin doesn't accept pagination[page]/pageSize — make
            // sure the interface doesn't expose a misleading `pagination`
            // property (JSDoc above may mention the word, but body must not
            // declare it).
            const ifaceStart = output.indexOf(
                'export interface UploadQueryParams {',
            )
            const ifaceEnd = output.indexOf('}', ifaceStart) + 1
            const ifaceBody = output.slice(ifaceStart, ifaceEnd)
            expect(ifaceBody).not.toMatch(/pagination\??\s*:/)
        })
        it('should generate NextOptions interface', () => {
            expect(output).toContain('export interface NextOptions')
            expect(output).toContain('revalidate?: number | false')
            expect(output).toContain('tags?: string[]')
            expect(output).toContain('cache?: RequestCache')
        })
        it('should generate StrapiClientConfig interface', () => {
            expect(output).toContain('export interface StrapiClientConfig')
            expect(output).toContain('baseURL: string')
            expect(output).toContain('token?: string')
            expect(output).toContain('fetch?: typeof fetch')
            expect(output).toContain('debug?: boolean')
            expect(output).toContain('credentials?: RequestCredentials')
        })
        it('should generate timeout option in StrapiClientConfig', () => {
            expect(output).toContain('timeout?: number')
        })
        it('should generate Equal utility type', () => {
            expect(output).toContain('type Equal<X, Y> =')
            expect(output).toContain('(<T>() => T extends X ? 1 : 2) extends')
            expect(output).toContain(
                '(<T>() => T extends Y ? 1 : 2) ? true : false',
            )
        })
        it('should generate GetPopulated type with conditional branches for each content type', () => {
            expect(output).toContain('type GetPopulated<TBase, TPopulate> =')
            expect(output).toContain(
                'Equal<TBase, Item> extends true ? ItemGetPayload<{ populate: TPopulate }> :',
            )
            expect(output).toContain(
                'Equal<TBase, User> extends true ? UserGetPayload<{ populate: TPopulate }> :',
            )
            expect(output).toContain(
                'Equal<TBase, Homepage> extends true ? HomepageGetPayload<{ populate: TPopulate }> :',
            )
            expect(output).not.toContain(
                'Equal<TBase, Category> extends true ? CategoryGetPayload',
            )
            expect(output).toContain('  TBase')
        })
        it('should generate SelectFields utility type', () => {
            expect(output).toContain(
                'type SelectFields<TFull, TBase, TFields extends string> =',
            )
            expect(output).toContain(
                "[TFields] extends [never] ? TFull : Pick<TBase, Extract<TFields | 'id' | 'documentId', keyof TBase>> & Omit<TFull, keyof TBase>",
            )
        })
    })

    describe('CollectionAPI', () => {
        it('should generate CollectionAPI class with 4 generic parameters', () => {
            expect(output).toContain('class CollectionAPI<')
            expect(output).toContain('TBase,')
            expect(output).toContain('TInput = Partial<TBase>,')
            expect(output).toContain('TFilters = Record<string, any>,')
            expect(output).toContain(
                'TPopulateKeys extends Record<string, any> = Record<string, any>',
            )
            expect(output).toContain('> extends BaseAPI {')
        })
        it('should generate find with 3 overloads', () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            const findOverloads = section.match(/^\s+find</gm)
            expect(findOverloads).not.toBeNull()
            expect(findOverloads!.length).toBeGreaterThanOrEqual(3)
        })
        it('find overload 1 should have TPopulate and TFields generics with SelectFields return', () => {
            expect(output).toContain(
                "find<const TPopulate extends TPopulateKeys, const TFields extends Exclude<keyof TBase & string, '__typename'> = never>(",
            )
            expect(output).toContain(
                '): Promise<SelectFields<GetPopulated<TBase, TPopulate>, TBase, TFields>[]>',
            )
        })
        it("find overload 2 should handle populate '*' | true with SelectFields return", () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            expect(section).toContain("params: { populate: '*' | true }")
            expect(section).toContain(
                "Promise<SelectFields<GetPopulated<TBase, '*'>, TBase, TFields>[]>",
            )
        })
        it('find overload 3 should be general case with SelectFields return', () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            expect(section).toContain(
                'Promise<SelectFields<TBase, TBase, TFields>[]>',
            )
        })
        it('should generate findOne with 3 overloads (with documentId parameter)', () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            const findOneOverloads = section.match(/^\s+findOne</gm)
            expect(findOneOverloads).not.toBeNull()
            expect(findOneOverloads!.length).toBeGreaterThanOrEqual(3)
            expect(section).toContain(
                'findOne<const TPopulate extends TPopulateKeys',
            )
            expect(section).toContain('documentId: string,')
        })
        it('should generate create method with TInput | FormData', () => {
            expect(output).toContain(
                'async create(data: TInput | FormData, nextOptions?: NextOptions): Promise<TBase>',
            )
        })
        it('should generate update method', () => {
            expect(output).toContain(
                'async update(documentId: string, data: TInput | FormData, nextOptions?: NextOptions): Promise<TBase>',
            )
        })
        it('should generate delete method', () => {
            expect(output).toContain(
                'async delete(documentId: string, nextOptions?: NextOptions): Promise<TBase | null>',
            )
        })
    })

    describe('CollectionAPI findWithMeta', () => {
        it('should generate findWithMeta method', () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            expect(section).toContain(
                'async findWithMeta(params?: any, nextOptions?: any): Promise<any>',
            )
        })
        it('findWithMeta should have 3 overloads', () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            const overloads = section.match(/^\s+findWithMeta</gm)
            expect(overloads).not.toBeNull()
            expect(overloads!.length).toBeGreaterThanOrEqual(3)
        })
        it('findWithMeta overloads should return StrapiResponse wrapping the array', () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            expect(section).toContain(
                'Promise<StrapiResponse<SelectFields<GetPopulated<TBase, TPopulate>, TBase, TFields>[]>>',
            )
            expect(section).toContain(
                "Promise<StrapiResponse<SelectFields<GetPopulated<TBase, '*'>, TBase, TFields>[]>>",
            )
            expect(section).toContain(
                'Promise<StrapiResponse<SelectFields<TBase, TBase, TFields>[]>>',
            )
        })
        it('findWithMeta implementation should return full response (not response.data)', () => {
            const section = output.slice(
                output.indexOf('class CollectionAPI<'),
                output.indexOf('class SingleTypeAPI<'),
            )
            // findWithMeta returns the full response
            expect(section).toContain(
                'return this.request<StrapiResponse<any[]>>(url, {}, nextOptions)',
            )
        })
    })

    describe('SingleTypeAPI', () => {
        it('should generate SingleTypeAPI class with 4 generic parameters', () => {
            expect(output).toContain('class SingleTypeAPI<')
            const section = output.slice(
                output.indexOf('class SingleTypeAPI<'),
                output.indexOf('class SingleTypeAPI<') + 500,
            )
            expect(section).toContain('TBase,')
            expect(section).toContain('TInput = Partial<TBase>,')
            expect(section).toContain('TFilters = Record<string, any>,')
            expect(section).toContain(
                'TPopulateKeys extends Record<string, any> = Record<string, any>',
            )
        })
        it('should generate find with 3 overloads (no array in return type)', () => {
            const section = output.slice(
                output.indexOf('class SingleTypeAPI<'),
                output.indexOf(
                    '// Auth API wrapper for users-permissions plugin',
                ),
            )
            expect(section).toContain(
                '): Promise<SelectFields<GetPopulated<TBase, TPopulate>, TBase, TFields>>',
            )
            const nonArrayReturns = section.match(
                /Promise<SelectFields<GetPopulated<TBase, TPopulate>, TBase, TFields>>\s*$/gm,
            )
            expect(nonArrayReturns).not.toBeNull()
        })
        it('should generate update method (no delete, no create)', () => {
            const section = output.slice(
                output.indexOf('class SingleTypeAPI<'),
                output.indexOf(
                    '// Auth API wrapper for users-permissions plugin',
                ),
            )
            expect(section).toContain(
                'async update(data: TInput | FormData, nextOptions?: NextOptions): Promise<TBase>',
            )
            expect(section).not.toContain('async delete(')
            expect(section).not.toContain('async create(')
        })
    })

    describe('StrapiClient', () => {
        it('should generate StrapiClient class', () => {
            expect(output).toContain('export class StrapiClient')
        })
        it('should have authentication property of AuthAPI type', () => {
            expect(output).toContain('authentication: AuthAPI')
        })
        it('should create CollectionAPI instances for collection types (items, categories)', () => {
            expect(output).toContain(
                "this.items = new CollectionAPI('items', this.config)",
            )
            expect(output).toContain(
                "this.categories = new CollectionAPI('categories', this.config)",
            )
        })
        it('should create SingleTypeAPI instance for single types (homepage)', () => {
            expect(output).toContain(
                "this.homepage = new SingleTypeAPI('homepage', this.config)",
            )
        })
        it('should include type parameters for types with populatable fields (4 params)', () => {
            expect(output).toContain(
                'items: CollectionAPI<Item, ItemInput, ItemFilters, ItemPopulateParam>',
            )
            expect(output).toContain(
                'users: UsersPermissionsUserAPI<User, UserInput, UserFilters, UserPopulateParam>',
            )
            expect(output).toContain(
                'homepage: SingleTypeAPI<Homepage, HomepageInput, HomepageFilters, HomepagePopulateParam>',
            )
        })
        it('should include type parameters for types without populatable fields (3 params)', () => {
            expect(output).toContain(
                'categories: CollectionAPI<Category, CategoryInput, CategoryFilters>',
            )
        })
        it('should have setToken method', () => {
            expect(output).toContain('setToken(token: string)')
            expect(output).toContain('this.config.token = token')
        })
        it('should have validateSchema method', () => {
            expect(output).toContain('async validateSchema()')
            expect(output).toContain('SCHEMA_HASH')
            // must hit the real plugin route, not the legacy `strapi-types` prefix
            expect(output).toContain('/api/strapi-typed-client/schema-hash')
            expect(output).not.toContain('/api/strapi-types/schema-hash')
        })

        it('should use pluralName as the property name and endpoint URL', () => {
            const schema: ParsedSchema = {
                contentTypes: [
                    {
                        name: 'ApiCampusCampus',
                        cleanName: 'Campus',
                        collectionName: 'campuses',
                        singularName: 'campus',
                        pluralName: 'campus',
                        kind: 'collection',
                        attributes: [
                            {
                                name: 'name',
                                type: { kind: 'string' },
                                required: true,
                            },
                        ],
                        relations: [],
                        media: [],
                        components: [],
                        dynamicZones: [],
                    },
                ],
                components: [],
            }
            const result = new ClientGenerator().generate(schema)

            expect(result).toContain(
                'campus: CollectionAPI<Campus, CampusInput, CampusFilters>',
            )
            expect(result).toContain(
                "this.campus = new CollectionAPI('campus', this.config)",
            )
            expect(result).not.toContain('campuses:')
            expect(result).not.toContain("'campuses'")
        })

        it('should strip pluralName (not `controller + "s"`) from custom-route paths', () => {
            // Regression for #48: custom endpoints on collections whose
            // pluralName differs from `singularName + "s"` (irregular English
            // plurals, non-English names like the Portuguese pesquisador →
            // pesquisadores) were generating URLs with a leftover suffix
            // (`/api/pesquisadoreses/<action>`) because the path-stripping
            // logic naively appended `s` to the controller name.
            const schema: ParsedSchema = {
                contentTypes: [
                    {
                        name: 'ApiPesquisadorPesquisador',
                        cleanName: 'Pesquisador',
                        collectionName: 'pesquisadores',
                        singularName: 'pesquisador',
                        pluralName: 'pesquisadores',
                        kind: 'collection',
                        attributes: [
                            {
                                name: 'name',
                                type: { kind: 'string' },
                                required: true,
                            },
                        ],
                        relations: [],
                        media: [],
                        components: [],
                        dynamicZones: [],
                    },
                ],
                components: [],
            }
            const endpoints: ParsedEndpoint[] = [
                {
                    method: 'POST',
                    path: '/pesquisadores/custom-action',
                    handler: 'api::pesquisador.pesquisador.customAction',
                    controller: 'pesquisador',
                    action: 'customAction',
                },
            ]
            const result = new ClientGenerator().generate(schema, endpoints)

            expect(result).toContain(
                '`${this.config.baseURL}/api/${this.endpoint}/custom-action`',
            )
            expect(result).not.toContain('/pesquisadoreses')
            expect(result).not.toContain('${this.endpoint}es/')
        })
    })

    describe('Auth types', () => {
        it('should generate LoginCredentials interface', () => {
            expect(output).toContain('export interface LoginCredentials')
            expect(output).toContain('identifier: string')
            expect(output).toContain('password: string')
        })
        it('should generate RegisterData interface', () => {
            expect(output).toContain('export interface RegisterData')
            expect(output).toContain('username: string')
            expect(output).toContain('email: string')
        })
        it('should generate AuthResponse interface', () => {
            expect(output).toContain('export interface AuthResponse')
            expect(output).toContain('jwt: string')
            expect(output).toContain('user: User')
        })
        it('should generate AuthAPI class', () => {
            expect(output).toContain('class AuthAPI extends BaseAPI')
        })
    })

    describe('AuthAPI overloads', () => {
        it('me() should have 3 overloads with TFields generic', () => {
            const authSection = output.slice(
                output.indexOf('class AuthAPI extends BaseAPI'),
            )
            const meOverloads = authSection.match(/^\s+me</gm)
            expect(meOverloads).not.toBeNull()
            expect(meOverloads!.length).toBe(3)
        })
        it('me() overload 1 should use SelectFields<GetPopulated<User, TPopulate>, User, TFields>', () => {
            expect(output).toContain(
                "me<const TPopulate extends UserPopulateParam, const TFields extends Exclude<keyof User & string, '__typename'> = never>",
            )
            expect(output).toContain(
                'Promise<SelectFields<GetPopulated<User, TPopulate>, User, TFields>>',
            )
        })
        it("me() overload 2 should handle populate '*' | true", () => {
            const authSection = output.slice(
                output.indexOf('class AuthAPI extends BaseAPI'),
            )
            expect(authSection).toContain(
                "params: { populate: '*' | true } & QueryParams<User, UserFilters, '*' | true, TFields>",
            )
            expect(authSection).toContain(
                "Promise<SelectFields<GetPopulated<User, '*'>, User, TFields>>",
            )
        })
        it('me() overload 3 should be general case', () => {
            const authSection = output.slice(
                output.indexOf('class AuthAPI extends BaseAPI'),
            )
            expect(authSection).toContain(
                "params?: QueryParams<User, UserFilters, UserPopulateParam | (keyof UserPopulateParam & string)[] | '*' | boolean, TFields>",
            )
            expect(authSection).toContain(
                'Promise<SelectFields<User, User, TFields>>',
            )
        })
        it('updateMe() should have 3 overloads with TFields generic', () => {
            const authSection = output.slice(
                output.indexOf('class AuthAPI extends BaseAPI'),
            )
            const updateMeOverloads = authSection.match(/^\s+updateMe</gm)
            expect(updateMeOverloads).not.toBeNull()
            expect(updateMeOverloads!.length).toBe(3)
        })
        it('updateMe() should accept Partial<User> as data parameter', () => {
            const authSection = output.slice(
                output.indexOf('class AuthAPI extends BaseAPI'),
            )
            expect(authSection).toContain('data: Partial<User>,')
        })
    })

    describe('Standalone controller / content type pluralName collisions', () => {
        // Reproduces the case where the users-permissions plugin exposes a
        // standalone `permissions` controller (/api/users-permissions/permissions)
        // AND the project has a `Permission` content type whose pluralName is
        // also `permissions` (/api/permissions). These are two distinct
        // endpoints — both should be callable from the client. Without
        // disambiguation the generator emits `permissions` twice on
        // StrapiClient, producing a "Duplicate member" esbuild error.
        const schema: ParsedSchema = {
            contentTypes: [
                {
                    name: 'PluginUsersPermissionsPermission',
                    cleanName: 'Permission',
                    collectionName: 'up_permissions',
                    singularName: 'permission',
                    pluralName: 'permissions',
                    kind: 'collection',
                    attributes: [
                        {
                            name: 'action',
                            type: { kind: 'string' },
                            required: true,
                        },
                    ],
                    relations: [],
                    media: [],
                    components: [],
                    dynamicZones: [],
                },
            ],
            components: [],
        }

        const endpoints: ParsedEndpoint[] = [
            {
                method: 'GET',
                path: '/permissions',
                handler: 'plugin::users-permissions.permissions.getPermissions',
                controller: 'permissions',
                action: 'getPermissions',
                pluginName: 'users-permissions',
            },
        ]

        const result = new ClientGenerator().generate(schema, endpoints)
        const clientSection = result.slice(
            result.indexOf('export class StrapiClient'),
        )

        it('should emit the content type collection property exactly once', () => {
            const permissionsDeclarations =
                clientSection.match(/^\s*permissions:\s/gm) ?? []
            expect(permissionsDeclarations.length).toBe(1)
        })

        it('should preserve the standalone plugin endpoint under a disambiguated name', () => {
            // The standalone class is still emitted (under a plugin-prefixed
            // name) so the /api/users-permissions/permissions endpoint remains
            // callable — we only rename to avoid the property collision.
            expect(result).toContain('class UsersPermissionsPermissionsAPI')
            expect(clientSection).toContain(
                'usersPermissionsPermissions: UsersPermissionsPermissionsAPI',
            )
            expect(clientSection).toContain(
                'this.usersPermissionsPermissions = new UsersPermissionsPermissionsAPI(this.config)',
            )
        })
    })

    describe('Plugin APIs (registry-driven)', () => {
        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('emits UploadAPI class in the generated output', () => {
            expect(output).toContain('class UploadAPI extends BaseAPI')
        })

        it('declares `upload: UploadAPI` on StrapiClient', () => {
            const clientSection = output.slice(
                output.indexOf('export class StrapiClient'),
            )
            expect(clientSection).toContain('upload: UploadAPI')
        })

        it('initializes `this.upload = new UploadAPI(this.config)`', () => {
            const clientSection = output.slice(
                output.indexOf('export class StrapiClient'),
            )
            expect(clientSection).toContain(
                'this.upload = new UploadAPI(this.config)',
            )
        })

        it('skips built-in upload registry entry when user has a custom standalone `upload` controller', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

            const customUploadEndpoint: ParsedEndpoint = {
                method: 'POST',
                path: '/upload/process',
                handler: 'api::upload.upload.process',
                controller: 'upload',
                action: 'process',
            }

            const result = new ClientGenerator().generate(mockSchema, [
                customUploadEndpoint,
            ])
            const clientSection = result.slice(
                result.indexOf('export class StrapiClient'),
            )

            // Our registry-driven block should be absent — the marker comment
            // and the dedicated init block are emitted only when activePlugins
            // is non-empty.
            expect(clientSection).not.toContain(
                '// Plugin APIs (registry-driven)',
            )
            expect(clientSection).not.toContain('// Initialize plugin APIs')

            // Warning should be emitted
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining("Custom 'upload' controller detected"),
            )

            // The registry-driven UploadAPI class should NOT be emitted —
            // the user's standalone class (also named UploadAPI by
            // customApiGenerator) takes over completely. We assert that the
            // class declaration appears only once across the whole output.
            const uploadClassDeclarations =
                result.match(/^class UploadAPI extends BaseAPI/gm) ?? []
            expect(uploadClassDeclarations.length).toBe(1)
        })
    })

    describe('Users & Permissions API', () => {
        const upSection = output.slice(
            output.indexOf('class UsersPermissionsUserAPI<'),
            output.indexOf('class AuthAPI'),
        )
        const collectionSection = output.slice(
            output.indexOf('class CollectionAPI<'),
            output.indexOf('class SingleTypeAPI<'),
        )

        it('generates a UsersPermissionsUserAPI class extending CollectionAPI', () => {
            expect(output).toContain('class UsersPermissionsUserAPI<')
            expect(upSection).toContain('extends CollectionAPI<')
        })

        it('wires the users content type to UsersPermissionsUserAPI (declaration + init)', () => {
            expect(output).toMatch(/\busers: UsersPermissionsUserAPI</)
            expect(output).toContain(
                "this.users = new UsersPermissionsUserAPI('users', this.config)",
            )
        })

        it('overrides wrapBody to send a flat body (no { data } envelope)', () => {
            expect(upSection).toContain('protected wrapBody(data: any): any')
            expect(upSection).toMatch(
                /wrapBody\(data: any\): any \{\s*return data\s*\}/,
            )
        })

        it('overrides unwrap to return the flat response (no .data)', () => {
            expect(upSection).toContain('protected unwrap(response: any): any')
            expect(upSection).toMatch(
                /unwrap\(response: any\): any \{\s*return response\s*\}/,
            )
        })

        it('CollectionAPI keeps the { data } envelope by default (no regression)', () => {
            expect(collectionSection).toMatch(
                /wrapBody\(data: any\): any \{\s*return \{ data \}\s*\}/,
            )
            expect(collectionSection).toMatch(
                /unwrap\(response: any\): any \{\s*return response\?\.data\s*\}/,
            )
        })

        it('CollectionAPI mutation methods route through wrapBody/unwrap', () => {
            expect(collectionSection).toContain(
                'JSON.stringify(this.wrapBody(data))',
            )
            expect(collectionSection).toContain('return this.unwrap(response)')
            expect(collectionSection).not.toContain('JSON.stringify({ data })')
        })

        it('regular collections still use CollectionAPI (no regression)', () => {
            expect(output).toMatch(/\bitems: CollectionAPI</)
            expect(output).toContain(
                "this.items = new CollectionAPI('items', this.config)",
            )
        })
    })
})
