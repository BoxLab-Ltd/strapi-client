/**
 * Shared utilities for Strapi Types Generator
 * @module shared
 */

// String manipulation utilities
export {
    toCamelCase,
    toLowerFirst,
    toPascalCase,
    toKebabCase,
    toSnakeCase,
    capitalize,
    pluralize,
    toPascalCasePreserve,
    extractPathParams,
} from './string-utils.js'

// Naming conventions utilities
export {
    convertComponentName,
    extractCleanName,
    toEndpointName,
    extractRelationTarget,
    toComponentUid,
    extractComponentCategory,
} from './naming-utils.js'

// Schema hashing utilities
export {
    computeSchemaHash,
    schemasMatch,
    shortHash,
    generateSchemaMetadata,
} from './schema-hash.js'
export type { SchemaMetadata } from './schema-hash.js'

// Endpoint types (shared between plugin and CLI)
export type {
    EndpointType,
    ParsedEndpoint,
    ExtraControllerType,
    EndpointsResponse,
} from './endpoint-types.js'

// Strapi schema types (shared between plugin and CLI)
export type {
    StrapiAttribute,
    StrapiContentType,
    StrapiComponent,
    ExtractedSchema,
    SchemaResponse,
    HashResponse,
} from './strapi-schema-types.js'

// Constants
export {
    SYSTEM_FIELDS,
    PRIVATE_FIELDS,
    SKIP_FIELDS,
    FILTER_OPERATORS,
    RELATION_TYPES,
    CRUD_METHODS,
    PACKAGE_NAME,
    SCHEMA_API_PREFIX,
} from './constants.js'
