/**
 * Shared Strapi schema types
 *
 * These types describe the raw schema structure as extracted from Strapi runtime.
 * Used by both the plugin (server-side extraction) and the CLI (API consumption).
 *
 * @module shared/strapi-schema-types
 */

import type { ParsedEndpoint, ExtraControllerType } from './endpoint-types.js'

/**
 * Strapi attribute structure from runtime schema
 */
export interface StrapiAttribute {
    type: string
    required?: boolean
    private?: boolean
    relation?: string
    target?: string
    component?: string
    repeatable?: boolean
    components?: string[]
    enum?: string[]
    multiple?: boolean
    // Validation constraints (present on scalar attributes that declare them)
    unique?: boolean
    default?: unknown
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    regex?: string
    [key: string]: unknown
}

/**
 * Strapi content type structure from runtime schema
 */
export interface StrapiContentType {
    uid: string
    kind: 'collectionType' | 'singleType'
    collectionName: string
    info: {
        singularName: string
        pluralName: string
        displayName: string
        description?: string
    }
    attributes: Record<string, StrapiAttribute>
}

/**
 * Strapi component structure from runtime schema
 */
export interface StrapiComponent {
    uid: string
    category: string
    info: {
        displayName: string
        description?: string
    }
    attributes: Record<string, StrapiAttribute>
}

/**
 * Complete schema extracted from Strapi
 */
export interface ExtractedSchema {
    contentTypes: Record<string, StrapiContentType>
    components: Record<string, StrapiComponent>
}

/**
 * users-permissions JWT mode detected on the backend at generation time.
 * 'refresh' = Strapi 5.43+ `jwtManagement: 'refresh'` (short access JWT +
 * rotating refresh token); 'legacy' = everything else.
 */
export type AuthMode = 'legacy' | 'refresh'

/**
 * Full schema response from the plugin API
 */
export interface SchemaResponse {
    schema: ExtractedSchema
    endpoints: ParsedEndpoint[]
    pluginEndpoints?: ParsedEndpoint[]
    extraTypes: ExtraControllerType[]
    /** Absent on plugins older than 2.1.0 — treat as 'legacy'. */
    authMode?: AuthMode
    hash: string
    generatedAt: string
}

/**
 * Lightweight hash-only response from the plugin API
 */
export interface HashResponse {
    hash: string
    generatedAt: string
}
