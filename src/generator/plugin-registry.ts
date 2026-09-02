/**
 * Declarative registry of Strapi plugin content-API contracts.
 *
 * Each entry describes a plugin and the endpoints it exposes. The
 * `PluginApiGenerator` consumes this registry to emit typed standalone API
 * classes on `StrapiClient` (e.g. `client.upload`).
 *
 * To add support for a new CRUD-style plugin, append a `PluginContract` here.
 * No other code changes are required — generation, property declaration, and
 * init wiring all flow from this registry.
 *
 * Auth (users-permissions) is intentionally NOT in the registry: it has
 * non-CRUD endpoints (OAuth callback, forgot/reset/change password,
 * me/updateMe with populate inference) that don't fit the declarative shape.
 * It stays in `auth-api-generator.ts`.
 */

export interface PluginEndpoint {
    /** Method name on the generated API class (e.g. 'findOne'). */
    methodName: string
    /** HTTP method. */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    /**
     * Path relative to /api, may contain `:paramName` segments.
     * Example: '/upload/files/:id'.
     */
    path: string
    /** TypeScript type expression for the body parameter, if any. */
    bodyType?: string
    /** TypeScript type expression for the query params, if any. */
    queryType?: string
    /** Path-parameter types, keyed by param name as it appears in `path`. */
    paramTypes?: Record<string, string>
    /** TypeScript type expression for the response. */
    responseType: string
    /** Optional one-line description used as a JSDoc comment on the method. */
    description?: string
    /**
     * Optional former name kept as a `@deprecated` alias that delegates to
     * `methodName`. Used to rename a method without breaking consumers.
     */
    deprecatedAlias?: string
}

export interface PluginContract {
    /** Strapi plugin name (informational, not used for routing). */
    pluginName: string
    /** Property name on `StrapiClient` (e.g. 'upload' → `client.upload`). */
    clientProperty: string
    /** Class name for the generated API class (e.g. 'UploadAPI'). */
    className: string
    /** errorPrefix passed to `BaseAPI.request()`. */
    errorPrefix: string
    /** Endpoints this plugin exposes. */
    endpoints: PluginEndpoint[]
}

export const PLUGIN_REGISTRY: PluginContract[] = [
    {
        pluginName: 'upload',
        clientProperty: 'upload',
        className: 'UploadAPI',
        errorPrefix: 'Strapi Upload',
        endpoints: [
            {
                methodName: 'upload',
                method: 'POST',
                path: '/upload',
                bodyType: 'FormData',
                responseType: 'MediaFile[]',
                description:
                    'Upload one or more files. Pass FormData with field "files".',
            },
            {
                methodName: 'find',
                method: 'GET',
                path: '/upload/files',
                queryType: 'UploadQueryParams',
                responseType: 'MediaFile[]',
                description:
                    'List uploaded files. Supports filters/sort and flat start/limit pagination.',
            },
            {
                methodName: 'findOne',
                method: 'GET',
                path: '/upload/files/:id',
                paramTypes: { id: 'number' },
                responseType: 'MediaFile',
                description: 'Get a single uploaded file by numeric id.',
            },
            {
                methodName: 'delete',
                deprecatedAlias: 'destroy',
                method: 'DELETE',
                path: '/upload/files/:id',
                paramTypes: { id: 'number' },
                responseType: 'MediaFile',
                description:
                    'Delete an uploaded file by numeric id. Returns the deleted file.',
            },
        ],
    },
    {
        pluginName: 'i18n',
        clientProperty: 'i18n',
        className: 'I18nAPI',
        errorPrefix: 'Strapi i18n',
        endpoints: [
            {
                methodName: 'locales',
                method: 'GET',
                path: '/i18n/locales',
                responseType: 'I18nLocale[]',
                description:
                    'List the configured locales. Returns a bare array — this route answers outside the { data, meta } envelope.',
            },
        ],
    },
]
