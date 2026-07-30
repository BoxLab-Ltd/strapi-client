/**
 * Filters Generator
 * Generates type-safe filter interfaces for Strapi entities
 */

import { Project } from 'ts-morph'
import {
    ParsedSchema,
    ContentType,
    Component,
    Attribute,
} from '../../schema-types.js'

/**
 * Generate filter utility types (static block)
 */
export function generateFilterUtilityTypes(): string {
    return `// ============================================
// Filter Utility Types
// ============================================

/** String filter operators */
export interface StringFilterOperators {
  $eq?: string
  $eqi?: string
  $ne?: string
  $nei?: string
  $in?: string[]
  $notIn?: string[]
  $contains?: string
  $notContains?: string
  $containsi?: string
  $notContainsi?: string
  $startsWith?: string
  $startsWithi?: string
  $endsWith?: string
  $endsWithi?: string
  $null?: boolean
  $notNull?: boolean
}

/** Number filter operators */
export interface NumberFilterOperators {
  $eq?: number
  $ne?: number
  $lt?: number
  $lte?: number
  $gt?: number
  $gte?: number
  $in?: number[]
  $notIn?: number[]
  $between?: [number, number]
  $null?: boolean
  $notNull?: boolean
}

/** Boolean filter operators */
export interface BooleanFilterOperators {
  $eq?: boolean
  $ne?: boolean
  $null?: boolean
  $notNull?: boolean
}

/** Date filter operators (dates are strings in Strapi) */
export interface DateFilterOperators {
  $eq?: string
  $ne?: string
  $lt?: string
  $lte?: string
  $gt?: string
  $gte?: string
  $in?: string[]
  $notIn?: string[]
  $between?: [string, string]
  $null?: boolean
  $notNull?: boolean
}

/** ID filter operators (for relations) */
export interface IdFilterOperators {
  $eq?: number | string
  $ne?: number | string
  $in?: (number | string)[]
  $notIn?: (number | string)[]
  $null?: boolean
  $notNull?: boolean
}

/** Relation filter - filter by nested fields */
export type RelationFilter<T> = {
  id?: number | IdFilterOperators
  documentId?: string | StringFilterOperators
} & {
  [K in keyof T]?: T[K] extends string
    ? string | StringFilterOperators
    : T[K] extends number
    ? number | NumberFilterOperators
    : T[K] extends boolean
    ? boolean | BooleanFilterOperators
    : any
}

/** Logical operators for combining filters */
export interface LogicalOperators<T> {
  $and?: T[]
  $or?: T[]
  $not?: T
}
`
}

/**
 * Get the filter type for an attribute
 */
function getFilterTypeForAttribute(attr: Attribute): string {
    const type = attr.type

    switch (type.kind) {
        case 'string':
        case 'text':
        case 'richtext':
        case 'email':
            return 'string | StringFilterOperators'

        case 'integer':
        case 'biginteger':
        case 'float':
        case 'decimal':
            return 'number | NumberFilterOperators'

        case 'boolean':
            return 'boolean | BooleanFilterOperators'

        case 'date':
        case 'datetime':
        case 'time':
            return 'string | DateFilterOperators'

        case 'enumeration': {
            const enumValues = type.values.map(v => `'${v}'`).join(' | ')
            return `(${enumValues}) | StringFilterOperators`
        }

        case 'json':
            return 'any' // JSON fields can have any filter

        default:
            return 'any'
    }
}

/**
 * Build filter interface properties for a content type or a component
 */
function buildFilterProperties(
    type: ContentType | Component,
    isComponent: boolean,
) {
    const systemFields = isComponent
        ? [
              {
                  name: 'id',
                  type: 'number | IdFilterOperators',
                  hasQuestionToken: true,
              },
          ]
        : [
              {
                  name: 'id',
                  type: 'number | IdFilterOperators',
                  hasQuestionToken: true,
              },
              {
                  name: 'documentId',
                  type: 'string | StringFilterOperators',
                  hasQuestionToken: true,
              },
              {
                  name: 'createdAt',
                  type: 'string | DateFilterOperators',
                  hasQuestionToken: true,
              },
              {
                  name: 'updatedAt',
                  type: 'string | DateFilterOperators',
                  hasQuestionToken: true,
              },
              {
                  name: 'publishedAt',
                  type: 'string | DateFilterOperators',
                  hasQuestionToken: true,
              },
          ]

    return [
        ...systemFields,
        ...type.attributes.map(attr => ({
            name: attr.name,
            type: getFilterTypeForAttribute(attr),
            hasQuestionToken: true,
        })),
        ...type.relations.map(rel => ({
            name: rel.name,
            type: '{ id?: number | IdFilterOperators; documentId?: string | StringFilterOperators; [key: string]: any }',
            hasQuestionToken: true,
        })),
        ...type.media.map(media => ({
            name: media.name,
            type: '{ id?: number | IdFilterOperators; [key: string]: any }',
            hasQuestionToken: true,
        })),
        // Repeatable components share the single shape — Strapi matches on any element.
        ...type.components.map(comp => ({
            name: comp.name,
            type: `${comp.componentType}Filters`,
            hasQuestionToken: true,
        })),
        // No dynamic zones: Strapi cannot filter polymorphic structures.
    ]
}

/**
 * Generate filter interface for a single content type
 */
export function generateEntityFilters(ct: ContentType): string {
    const project = new Project({ useInMemoryFileSystem: true })
    const sf = project.createSourceFile('filters.ts')

    sf.addInterface({
        name: `${ct.cleanName}Filters`,
        isExported: true,
        extends: [`LogicalOperators<${ct.cleanName}Filters>`],
        docs: [`Type-safe filters for ${ct.cleanName}`],
        properties: buildFilterProperties(ct, false),
    })

    return sf.getFullText()
}

/**
 * Generate filter interface for a single component
 */
export function generateComponentFilters(component: Component): string {
    const project = new Project({ useInMemoryFileSystem: true })
    const sf = project.createSourceFile('component-filters.ts')

    sf.addInterface({
        name: `${component.cleanName}Filters`,
        isExported: true,
        extends: [`LogicalOperators<${component.cleanName}Filters>`],
        docs: [`Type-safe filters for the ${component.cleanName} component`],
        properties: buildFilterProperties(component, true),
    })

    return sf.getFullText()
}

/**
 * Generate all filter interfaces for the schema
 */
export function generateAllFilters(schema: ParsedSchema): string {
    const project = new Project({ useInMemoryFileSystem: true })
    const sf = project.createSourceFile('all-filters.ts')

    // Add utility types (static block)
    sf.addStatements(generateFilterUtilityTypes())

    // Generate filter interface for each component
    for (const component of schema.components) {
        sf.addStatements(generateComponentFilters(component))
    }

    // Generate filter interface for each content type
    for (const ct of schema.contentTypes) {
        sf.addInterface({
            name: `${ct.cleanName}Filters`,
            isExported: true,
            extends: [`LogicalOperators<${ct.cleanName}Filters>`],
            docs: [`Type-safe filters for ${ct.cleanName}`],
            properties: buildFilterProperties(ct, false),
        })
    }

    // Generate union type of all filters
    const filterNames = schema.contentTypes.map(ct => `${ct.cleanName}Filters`)
    sf.addTypeAlias({
        name: 'AnyEntityFilters',
        isExported: true,
        type: filterNames.join(' | '),
        docs: ['Union of all entity filters'],
    })

    // Generate mapping type
    sf.addInterface({
        name: 'EntityFiltersMap',
        isExported: true,
        docs: ['Map from entity type to its filter type'],
        properties: schema.contentTypes.map(ct => ({
            name: ct.cleanName,
            type: `${ct.cleanName}Filters`,
        })),
    })

    return sf.getFullText()
}

/**
 * Generate typed QueryParams interface (static block)
 */
export function generateTypedQueryParams(): string {
    return `// ============================================
// Typed Query Parameters
// ============================================

/** Sort direction */
export type SortDirection = 'asc' | 'desc'

/** Sort option - can be a field name or field:direction */
export type SortOption<T> = keyof T & string | \`\${keyof T & string}:\${SortDirection}\`

/** Typed query parameters */
export interface TypedQueryParams<
  TEntity,
  TFilters = Record<string, any>,
  TPopulate = any
> {
  /** Type-safe filters */
  filters?: TFilters
  /** Sort by field(s) */
  sort?: SortOption<TEntity> | SortOption<TEntity>[]
  /** Pagination options */
  pagination?: {
    page?: number
    pageSize?: number
    limit?: number
    start?: number
  }
  /** Populate relations */
  populate?: TPopulate
  /** Select specific fields */
  fields?: (keyof TEntity)[]
}
`
}
