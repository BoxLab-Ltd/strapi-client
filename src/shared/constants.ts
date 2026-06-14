/**
 * Constants for Strapi Types Generator
 * @module shared/constants
 */

/**
 * System fields that are automatically added to all Strapi content types
 * These are included in output types but not in input types
 */
export const SYSTEM_FIELDS = [
    'id',
    'documentId',
    'createdAt',
    'updatedAt',
    'publishedAt',
] as const

/**
 * Private/internal Strapi fields that should be excluded from generated types
 * These fields are managed by Strapi and not accessible via API
 */
export const PRIVATE_FIELDS = ['createdBy', 'updatedBy'] as const

/**
 * All fields to skip when generating entity types
 */
export const SKIP_FIELDS = [...PRIVATE_FIELDS] as const

/**
 * Strapi filter operators
 */
export const FILTER_OPERATORS = {
    // Comparison operators
    $eq: 'Equal',
    $eqi: 'Equal (case-insensitive)',
    $ne: 'Not equal',
    $nei: 'Not equal (case-insensitive)',
    $lt: 'Less than',
    $lte: 'Less than or equal',
    $gt: 'Greater than',
    $gte: 'Greater than or equal',
    $in: 'In array',
    $notIn: 'Not in array',
    $null: 'Is null',
    $notNull: 'Is not null',
    $between: 'Between (array of [start, end])',

    // String operators
    $contains: 'Contains substring',
    $notContains: 'Does not contain substring',
    $containsi: 'Contains substring (case-insensitive)',
    $notContainsi: 'Does not contain substring (case-insensitive)',
    $startsWith: 'Starts with',
    $startsWithi: 'Starts with (case-insensitive)',
    $endsWith: 'Ends with',
    $endsWithi: 'Ends with (case-insensitive)',

    // Logical operators (for combining filters)
    $and: 'Logical AND',
    $or: 'Logical OR',
    $not: 'Logical NOT',
} as const

/**
 * Strapi relation types
 */
export const RELATION_TYPES = {
    oneToOne: { isArray: false, nullable: true },
    oneToMany: { isArray: true, nullable: false },
    manyToOne: { isArray: false, nullable: true },
    manyToMany: { isArray: true, nullable: false },
    morphToOne: { isArray: false, nullable: true },
    morphToMany: { isArray: true, nullable: false },
    morphOne: { isArray: false, nullable: true },
    morphMany: { isArray: true, nullable: false },
} as const

/**
 * Default HTTP methods for Strapi CRUD operations
 */
export const CRUD_METHODS = {
    find: 'GET',
    findOne: 'GET',
    create: 'POST',
    update: 'PUT',
    delete: 'DELETE',
} as const

/**
 * Package version (injected at build time or read from package.json)
 */
export const PACKAGE_NAME = 'strapi-typed-client'

/**
 * Prefix for the plugin's content-api routes. This is the Strapi plugin id
 * (`/api/<plugin-id>/...`), which is not necessarily the npm package name.
 */
export const SCHEMA_API_PREFIX = '/api/strapi-typed-client'
