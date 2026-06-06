/**
 * Schema Transformer
 *
 * Converts Strapi plugin's JSON schema (ExtractedSchema) to ParsedSchema
 * used by the TypeScript generators.
 *
 * This enables the CLI to generate types directly from Strapi runtime schema
 * without parsing .d.ts files.
 *
 * @module core/schema-transformer
 */

import type {
    ParsedSchema,
    ContentType,
    Component,
    Attribute,
    AttributeType,
    Relation,
    MediaField,
    ComponentField,
    DynamicZoneField,
} from '../schema-types.js'

import {
    toPascalCase,
    convertComponentName,
    extractComponentCategory,
} from '../shared/index.js'

import type {
    StrapiAttribute,
    StrapiContentType,
    StrapiComponent,
    ExtractedSchema,
} from '../shared/strapi-schema-types.js'

export type {
    StrapiAttribute,
    StrapiContentType,
    StrapiComponent,
    ExtractedSchema,
}

/**
 * Transform Strapi plugin schema to ParsedSchema format
 */
export function transformSchema(extracted: ExtractedSchema): ParsedSchema {
    const contentTypes: ContentType[] = []
    const components: Component[] = []

    // Sort by UID for a stable canonical order (Strapi registry order isn't
    // guaranteed stable, which otherwise produces ordering-only diff noise)

    // Transform components first (they may be referenced by content types)
    for (const [uid, strapiComponent] of Object.entries(
        extracted.components,
    ).sort(([a], [b]) => byUid(a, b))) {
        const component = transformComponent(uid, strapiComponent)
        components.push(component)
    }

    // Transform content types
    for (const [uid, strapiContentType] of Object.entries(
        extracted.contentTypes,
    ).sort(([a], [b]) => byUid(a, b))) {
        const contentType = transformContentType(uid, strapiContentType)
        contentTypes.push(contentType)
    }

    return { contentTypes, components }
}

/**
 * Deterministic, locale-independent UID comparator (codepoint order).
 */
function byUid(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Transform a single Strapi content type to ParsedSchema ContentType
 */
function transformContentType(uid: string, ct: StrapiContentType): ContentType {
    const cleanName = extractCleanNameFromUid(uid)
    const kind = ct.kind === 'singleType' ? 'single' : 'collection'

    const attributes: Attribute[] = []
    const relations: Relation[] = []
    const media: MediaField[] = []
    const componentFields: ComponentField[] = []
    const dynamicZones: DynamicZoneField[] = []

    // Process attributes
    for (const [attrName, attr] of Object.entries(ct.attributes)) {
        const result = processAttribute(attrName, attr)
        if (!result) continue

        switch (result.category) {
            case 'attribute':
                attributes.push(result.data as Attribute)
                break
            case 'relation':
                relations.push(result.data as Relation)
                break
            case 'media':
                media.push(result.data as MediaField)
                break
            case 'component':
                componentFields.push(result.data as ComponentField)
                break
            case 'dynamiczone':
                dynamicZones.push(result.data as DynamicZoneField)
                break
        }
    }

    // Detect plugin content types from uid
    const pluginName = uid.startsWith('plugin::')
        ? uid.split('::')[1].split('.')[0] // e.g., 'users-permissions'
        : undefined

    return {
        name: uidToInterfaceName(uid),
        cleanName,
        collectionName: ct.collectionName,
        singularName: ct.info.singularName,
        pluralName: ct.info.pluralName,
        kind,
        pluginName,
        attributes,
        relations,
        media,
        components: componentFields,
        dynamicZones,
    }
}

/**
 * Transform a single Strapi component to ParsedSchema Component
 */
function transformComponent(uid: string, comp: StrapiComponent): Component {
    const cleanName = convertComponentName(uid)
    const category = extractComponentCategory(uid)

    const attributes: Attribute[] = []
    const relations: Relation[] = []
    const media: MediaField[] = []
    const componentFields: ComponentField[] = []
    const dynamicZones: DynamicZoneField[] = []

    // Process attributes
    for (const [attrName, attr] of Object.entries(comp.attributes)) {
        const result = processAttribute(attrName, attr)
        if (!result) continue

        switch (result.category) {
            case 'attribute':
                attributes.push(result.data as Attribute)
                break
            case 'relation':
                relations.push(result.data as Relation)
                break
            case 'media':
                media.push(result.data as MediaField)
                break
            case 'component':
                componentFields.push(result.data as ComponentField)
                break
            case 'dynamiczone':
                dynamicZones.push(result.data as DynamicZoneField)
                break
        }
    }

    return {
        name: cleanName,
        cleanName,
        category,
        uid,
        attributes,
        relations,
        media,
        components: componentFields,
        dynamicZones,
    }
}

/**
 * Process a single attribute and categorize it
 */
type ProcessedAttribute =
    | { category: 'attribute'; data: Attribute }
    | { category: 'relation'; data: Relation }
    | { category: 'media'; data: MediaField }
    | { category: 'component'; data: ComponentField }
    | { category: 'dynamiczone'; data: DynamicZoneField }

function processAttribute(
    name: string,
    attr: StrapiAttribute,
): ProcessedAttribute | null {
    const required = attr.required ?? false

    // Handle relation
    if (attr.type === 'relation') {
        const target = attr.target || ''
        const relationType = normalizeRelationType(attr.relation || '')

        // Skip admin and non-users-permissions plugin relations
        if (target.startsWith('admin::')) return null
        if (
            target.startsWith('plugin::') &&
            !target.includes('users-permissions')
        ) {
            return null
        }

        return {
            category: 'relation',
            data: {
                name,
                relationType,
                target,
                targetType: extractCleanNameFromUid(target),
                required,
            },
        }
    }

    // Handle media
    if (attr.type === 'media') {
        return {
            category: 'media',
            data: {
                name,
                multiple: attr.multiple ?? false,
                required,
            },
        }
    }

    // Handle component
    if (attr.type === 'component') {
        const componentUid = attr.component || ''
        return {
            category: 'component',
            data: {
                name,
                component: componentUid,
                componentType: convertComponentName(componentUid),
                repeatable: attr.repeatable ?? false,
                required,
            },
        }
    }

    // Handle dynamic zone
    if (attr.type === 'dynamiczone') {
        const componentUids = attr.components || []
        return {
            category: 'dynamiczone',
            data: {
                name,
                components: componentUids,
                componentTypes: componentUids.map(c => convertComponentName(c)),
                required,
            },
        }
    }

    // Handle scalar types
    const attrType = mapStrapiType(attr)
    if (!attrType) return null

    return {
        category: 'attribute',
        data: {
            name,
            type: attrType,
            required,
        },
    }
}

/**
 * Map Strapi attribute type to AttributeType
 */
function mapStrapiType(attr: StrapiAttribute): AttributeType | null {
    switch (attr.type) {
        case 'string':
            return { kind: 'string' }
        case 'text':
            return { kind: 'text' }
        case 'richtext':
            return { kind: 'richtext' }
        case 'blocks':
            return { kind: 'blocks' }
        case 'email':
            return { kind: 'email' }
        case 'password':
            return null // passwords are never returned by Strapi API
        case 'uid':
            return { kind: 'string' }
        case 'integer':
            return { kind: 'integer' }
        case 'biginteger':
            return { kind: 'biginteger' }
        case 'float':
            return { kind: 'float' }
        case 'decimal':
            return { kind: 'decimal' }
        case 'boolean':
            return { kind: 'boolean' }
        case 'date':
            return { kind: 'date' }
        case 'time':
            return { kind: 'time' }
        case 'datetime':
        case 'timestamp':
            return { kind: 'datetime' }
        case 'json':
            return { kind: 'json' }
        case 'enumeration':
            return { kind: 'enumeration', values: attr.enum || [] }
        default:
            // Unknown type, skip it
            return null
    }
}

/**
 * Normalize Strapi relation type names
 */
function normalizeRelationType(
    relation: string,
): 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany' {
    const normalized = relation.toLowerCase().replace(/[^a-z]/g, '')

    switch (normalized) {
        case 'onetoone':
            return 'oneToOne'
        case 'onetomany':
            return 'oneToMany'
        case 'manytoone':
            return 'manyToOne'
        case 'manytomany':
            return 'manyToMany'
        default:
            // Default to manyToOne for unknown relation types
            return 'manyToOne'
    }
}

/**
 * Extract clean name from Strapi UID
 *
 * @example
 * extractCleanNameFromUid('api::item.item') // 'Item'
 * extractCleanNameFromUid('api::guide-type.guide-type') // 'GuideType'
 * extractCleanNameFromUid('plugin::users-permissions.user') // 'User'
 * extractCleanNameFromUid('shared.feature') // 'SharedFeature' (component)
 */
function extractCleanNameFromUid(uid: string): string {
    // Handle component UIDs (no :: prefix)
    if (!uid.includes('::')) {
        return convertComponentName(uid)
    }

    // Handle plugin types
    if (uid.startsWith('plugin::')) {
        const afterPlugin = uid.split('::')[1] // 'users-permissions.user'
        const modelName = afterPlugin.split('.').pop() || afterPlugin
        return toPascalCase(modelName)
    }

    // Handle API types
    if (uid.startsWith('api::')) {
        const afterApi = uid.split('::')[1] // 'item.item' or 'guide-type.guide-type'
        const modelName = afterApi.split('.').pop() || afterApi
        return toPascalCase(modelName)
    }

    // Fallback
    const parts = uid.split('.')
    return toPascalCase(parts[parts.length - 1] || uid)
}

/**
 * Convert UID to interface name (legacy format)
 *
 * @example
 * uidToInterfaceName('api::item.item') // 'ApiItemItem'
 * uidToInterfaceName('plugin::users-permissions.user') // 'PluginUsersPermissionsUser'
 */
function uidToInterfaceName(uid: string): string {
    // Remove :: and . then PascalCase each part
    return uid
        .split(/[:.]+/)
        .filter(Boolean)
        .map(part => toPascalCase(part))
        .join('')
}
