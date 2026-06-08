// Intermediate Representation (IR) types

export interface ParsedSchema {
    contentTypes: ContentType[]
    components: Component[]
}

export interface ContentType {
    name: string // e.g., "ApiItemItem"
    cleanName: string // e.g., "Item"
    collectionName: string
    singularName: string // Strapi info.singularName, used as controller/endpoint for single types
    pluralName: string // Strapi info.pluralName, used as collection endpoint
    kind: 'collection' | 'single'
    pluginName?: string // e.g., 'users-permissions' for plugin content types
    attributes: Attribute[] // Scalar fields only (no relations, media, or components)
    relations: Relation[] // Relations stored separately for Prisma-like behavior
    media: MediaField[] // Media fields require populate
    components: ComponentField[] // Component fields require populate
    dynamicZones: DynamicZoneField[] // Dynamic zone fields require populate
}

export interface Component {
    name: string // e.g., "LandingEditorFeature"
    cleanName: string // e.g., "LandingEditorFeature"
    category: string // e.g., "landing"
    uid: string // e.g., "landing.editor-feature" — used for __component discriminator
    attributes: Attribute[] // Scalar fields only (no relations, media, or components)
    relations: Relation[] // Relations stored separately
    media: MediaField[] // Media fields require populate
    components: ComponentField[] // Component fields require populate
    dynamicZones: DynamicZoneField[] // Dynamic zone fields require populate
}

export interface Relation {
    name: string // Field name
    relationType: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany'
    target: string // e.g., "api::item.item"
    targetType: string // Clean name e.g., "Item"
    required: boolean
}

export interface MediaField {
    name: string // Field name
    multiple: boolean // Single file or multiple files
    required: boolean
}

export interface ComponentField {
    name: string // Field name
    component: string // e.g., "landing.editor-feature"
    componentType: string // Clean name e.g., "LandingEditorFeature"
    repeatable: boolean // Single component or array
    required: boolean
}

export interface DynamicZoneField {
    name: string // Field name
    components: string[] // e.g., ["landing.editor-feature", "shared.feature"]
    componentTypes: string[] // Clean names e.g., ["LandingEditorFeature", "SharedFeature"]
    required: boolean
}

export interface Attribute {
    name: string
    type: AttributeType
    required: boolean
    unique?: boolean
    defaultValue?: any
    constraints?: AttributeConstraints
}

// Validation constraints from the Strapi schema; only type-relevant keys present
export interface AttributeConstraints {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    regex?: string
}

export type AttributeType =
    | { kind: 'string' }
    | { kind: 'text' }
    | { kind: 'richtext' }
    | { kind: 'blocks' }
    | { kind: 'email' }
    | { kind: 'integer' }
    | { kind: 'biginteger' }
    | { kind: 'float' }
    | { kind: 'decimal' }
    | { kind: 'boolean' }
    | { kind: 'date' }
    | { kind: 'datetime' }
    | { kind: 'time' }
    | { kind: 'json' }
    | { kind: 'enumeration'; values: string[] }
    | { kind: 'media'; multiple?: boolean }
    | { kind: 'component'; component: string; repeatable?: boolean }
    | { kind: 'dynamiczone'; components: string[] }
    | {
          kind: 'relation'
          relationType: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany'
          target: string
      }
