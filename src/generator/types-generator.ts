import {
    Project,
    SourceFile,
    OptionalKind,
    PropertySignatureStructure,
} from 'ts-morph'
import {
    ParsedSchema,
    ContentType,
    Component,
    Attribute,
} from '../schema-types.js'
import { TypeTransformer } from '../transformer/index.js'
import { buildConstraintDocs } from './constraint-docs.js'
import {
    generateFilterUtilityTypes,
    generateEntityFilters,
    generateComponentFilters,
    generateTypedQueryParams,
} from '../core/generator/filters-generator.js'

// Object-literal key: bare when a valid identifier, quoted otherwise.
function safeKey(name: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
}

export class TypesGenerator {
    private transformer: TypeTransformer
    private schema?: ParsedSchema

    constructor() {
        this.transformer = new TypeTransformer()
    }

    generate(schema: ParsedSchema): string {
        this.schema = schema
        const project = new Project({ useInMemoryFileSystem: true })
        const sf = project.createSourceFile('types.ts')

        // Header comments
        sf.addStatements([
            '/* eslint-disable */',
            '// Auto-generated TypeScript types from Strapi schema',
            '// Do not edit manually',
        ])

        // Base types (static block)
        sf.addStatements(this.generateBaseTypes())

        // Helper types (static block)
        sf.addStatements(this.generateHelperTypes())

        // Component interfaces
        for (const component of schema.components) {
            this.addComponentInterface(sf, component)
        }

        // Dynamic-zone variants of component interfaces (with __component
        // discriminator). Generated only for components actually used in
        // any dynamic zone — Strapi rejects __component on regular component
        // attributes, so the discriminator must live on the place of use, not
        // on the component itself.
        const dzComponentUids = this.collectDzComponentUids(schema)
        for (const component of schema.components) {
            if (dzComponentUids.has(component.uid)) {
                this.addComponentDzAlias(sf, component)
            }
        }

        // Component Create/Update Input interfaces
        for (const component of schema.components) {
            this.addComponentInputInterfaces(sf, component)
        }

        // Dynamic-zone Input variants
        for (const component of schema.components) {
            if (dzComponentUids.has(component.uid)) {
                this.addComponentDzInputAliases(sf, component)
            }
        }

        // Content type interfaces
        for (const contentType of schema.contentTypes) {
            this.addContentTypeInterface(sf, contentType)
        }

        // Create/Update Input type interfaces
        for (const contentType of schema.contentTypes) {
            this.addInputTypeInterfaces(sf, contentType)
        }

        // *Defaults consts (emitted only for entities that declare defaults)
        for (const contentType of schema.contentTypes) {
            this.addDefaultsConst(
                sf,
                `${contentType.cleanName}Defaults`,
                `${contentType.cleanName}CreateInput`,
                contentType.attributes,
            )
        }
        for (const component of schema.components) {
            this.addDefaultsConst(
                sf,
                `${component.cleanName}Defaults`,
                `${component.cleanName}CreateInput`,
                component.attributes,
            )
        }
        // Dynamic-zone form carries the __component discriminator; emitted only
        // for components actually used in a dynamic zone (matches the *DzInput
        // aliases). Always includes __component, even without attribute defaults.
        for (const component of schema.components) {
            if (dzComponentUids.has(component.uid)) {
                this.addDefaultsConst(
                    sf,
                    `${component.cleanName}DzDefaults`,
                    `${component.cleanName}DzCreateInput`,
                    component.attributes,
                    [`__component: ${JSON.stringify(component.uid)}`],
                )
            }
        }

        // PopulateParam types
        this.addPopulateParams(sf, schema)

        // Payload utility types
        this.addPayloadUtilityTypes(sf, schema)

        // Filter utility types (static block)
        sf.addStatements(generateFilterUtilityTypes())

        // Typed query params (static block)
        sf.addStatements(generateTypedQueryParams())

        // Component filters
        for (const component of schema.components) {
            sf.addStatements(generateComponentFilters(component))
        }

        // Entity-specific filters
        for (const contentType of schema.contentTypes) {
            sf.addStatements(generateEntityFilters(contentType))
        }

        return sf.getFullText()
    }

    private generateBaseTypes(): string {
        return `// Base types

/**
 * Scalar identifier accepted by the Strapi v5 REST API for relations and media.
 * Strings are treated as documentId; numbers fall back to the legacy numeric id.
 */
export type StrapiID = string | number

/**
 * Explicit relation operations supported by Strapi v5.
 * See: https://docs.strapi.io/cms/api/rest/relations
 */
export interface RelationOperations {
  connect?: StrapiID[] | { documentId: string; position?: { before?: StrapiID; after?: StrapiID; start?: true; end?: true } }[]
  disconnect?: StrapiID[]
  set?: StrapiID[]
}

/**
 * Input value for a relation field in create/update payloads.
 * Accepts a single id, an array of ids, or the explicit { connect | disconnect | set } form.
 * Passing a plain id or array is equivalent to 'set' — it overwrites existing relations.
 */
export type RelationInput = StrapiID | StrapiID[] | RelationOperations | null

/**
 * Input value for a single media file field. Accepts a documentId (string) or
 * legacy numeric id.
 */
export type MediaInput = StrapiID | null

/**
 * Input value for a multi-media field. Accepts an array of ids.
 */
export type MultiMediaInput = StrapiID[] | null

export interface MediaFormat {
  ext: string
  url: string
  hash: string
  mime: string
  name: string
  path: string | null
  size: number
  width: number
  height: number
  sizeInBytes: number
}

export interface BaseMediaFormats {
  thumbnail?: MediaFormat
  small?: MediaFormat
  medium?: MediaFormat
  large?: MediaFormat
  [key: string]: MediaFormat | undefined
}

export interface MediaFile {
  id: number
  name: string
  alternativeText: string | null
  caption: string | null
  focalPoint: { x: number; y: number } | null
  width: number | null
  height: number | null
  formats: BaseMediaFormats | null
  hash: string
  ext: string
  mime: string
  size: number
  url: string
  previewUrl: string | null
  provider: string
  createdAt: string
  updatedAt: string
}

// Strapi Blocks Editor API Types
// Based on: https://docs.strapi.io/dev-docs/api/document/blocks

/**
 * Main type for Strapi Blocks content
 */
export type BlocksContent = Block[]

/**
 * All possible block types
 */
export type Block =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | CodeBlock
  | ListBlock
  | ImageBlock

/**
 * Paragraph block - default text block
 */
export interface ParagraphBlock {
  type: 'paragraph'
  children: InlineNode[]
}

/**
 * Heading block - h1 to h6
 */
export interface HeadingBlock {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: InlineNode[]
}

/**
 * Quote block - blockquote
 */
export interface QuoteBlock {
  type: 'quote'
  children: InlineNode[]
}

/**
 * Code block - preformatted code with optional language
 */
export interface CodeBlock {
  type: 'code'
  language?: string
  children: InlineNode[]
}

/**
 * List block - ordered or unordered (supports nesting)
 */
export interface ListBlock {
  type: 'list'
  format: 'ordered' | 'unordered'
  children: (ListItemBlock | ListBlock)[]
}

/**
 * List item - individual item in a list
 */
export interface ListItemBlock {
  type: 'list-item'
  children: InlineNode[]
}

/**
 * Image block - embedded image
 */
export interface ImageBlock {
  type: 'image'
  image: {
    name: string
    alternativeText?: string | null
    url: string
    caption?: string | null
    width: number
    height: number
    formats?: BaseMediaFormats
    hash: string
    ext: string
    mime: string
    size: number
    previewUrl?: string | null
    provider: string
    provider_metadata?: unknown | null
    createdAt: string
    updatedAt: string
  }
  children: [{ type: 'text'; text: '' }]
}

/**
 * Inline nodes - text formatting and inline elements
 */
export type InlineNode = TextNode | LinkInline

/**
 * Plain text node with optional formatting
 */
export interface TextNode {
  type: 'text'
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
}

/**
 * Inline link
 */
export interface LinkInline {
  type: 'link'
  url: string
  children: TextNode[]
}`
    }

    private generateHelperTypes(): string {
        return `// Helper types for field and sort options in populate
type _EntityField<T> = Exclude<keyof T & string, '__typename'>
type _SortValue<T> = _EntityField<T> | \`\${_EntityField<T>}:\${"asc" | "desc"}\`

// Apply fields narrowing from populate entry (e.g. populate: { item: { fields: ["title"] } })
type _ApplyFields<TFull, TBase, TEntry> = TEntry extends true ? TFull : TEntry extends { fields: readonly (infer F extends string)[] } ? Pick<TBase, Extract<F | 'id' | 'documentId', keyof TBase>> & Omit<TFull, keyof TBase> : TFull`
    }

    // Constraint/default JSDoc for a property, as a spreadable ts-morph
    // structure fragment ({} when the attribute declares nothing).
    private docsFor(attr: Attribute): { docs?: string[] } {
        const lines = buildConstraintDocs(attr)
        return lines.length ? { docs: [lines.join('\n')] } : {}
    }

    // Emit `export const <constName> = { ... } as const satisfies Partial<...>`
    // from attributes carrying a schema default. `leading` lets callers prepend
    // fixed entries (e.g. the `__component` discriminator for dynamic zones).
    // Skipped entirely when there is nothing to emit.
    private addDefaultsConst(
        sf: SourceFile,
        constName: string,
        inputType: string,
        attributes: Attribute[],
        leading: string[] = [],
    ): void {
        const entries = [
            ...leading,
            ...attributes
                .filter(a => a.defaultValue !== undefined)
                .map(
                    a =>
                        `${safeKey(a.name)}: ${JSON.stringify(a.defaultValue)}`,
                ),
        ]
        if (entries.length === 0) return
        sf.addStatements(
            `export const ${constName} = { ${entries.join(', ')} } as const satisfies Partial<${inputType}>`,
        )
    }

    private addComponentInterface(sf: SourceFile, component: Component): void {
        sf.addInterface({
            name: component.cleanName,
            isExported: true,
            properties: [
                { name: 'id', type: 'number' },
                ...component.attributes.map(attr => ({
                    name: attr.name,
                    type: this.transformer.toTypeScript(
                        attr.type,
                        attr.required,
                    ),
                    ...this.docsFor(attr),
                })),
            ],
        })
    }

    private addComponentDzAlias(sf: SourceFile, component: Component): void {
        sf.addTypeAlias({
            name: `${component.cleanName}Dz`,
            isExported: true,
            type: `${component.cleanName} & { __component: '${component.uid}' }`,
        })
    }

    private addComponentDzInputAliases(
        sf: SourceFile,
        component: Component,
    ): void {
        for (const mode of ['Create', 'Update'] as const) {
            sf.addTypeAlias({
                name: `${component.cleanName}Dz${mode}Input`,
                isExported: true,
                type: `${component.cleanName}${mode}Input & { __component: '${component.uid}' }`,
            })
        }
    }

    private collectDzComponentUids(schema: ParsedSchema): Set<string> {
        const uids = new Set<string>()
        for (const ct of schema.contentTypes) {
            for (const dz of ct.dynamicZones) {
                for (const uid of dz.components) uids.add(uid)
            }
        }
        for (const comp of schema.components) {
            for (const dz of comp.dynamicZones) {
                for (const uid of dz.components) uids.add(uid)
            }
        }
        return uids
    }

    private addComponentInputInterfaces(
        sf: SourceFile,
        component: Component,
    ): void {
        for (const mode of ['Create', 'Update'] as const) {
            sf.addInterface({
                name: `${component.cleanName}${mode}Input`,
                docs: [`${mode} input for ${component.cleanName}`],
                isExported: true,
                properties: this.buildInputProperties(component, mode, true),
            })
        }
    }

    /**
     * Shared property list for `*CreateInput` / `*UpdateInput`. In create mode a
     * required *scalar* drops its `?` (and `| null`); update mode is fully
     * partial (every key optional). Required-ness is enforced for scalars only —
     * Strapi does not validate `required` on relations/media/components at the
     * REST layer, so forcing those keys would reject payloads it accepts.
     * Components / dynamic zones still split so their nested required scalars
     * are enforced in the Create variant.
     */
    private buildInputProperties(
        type: ContentType | Component,
        mode: 'Create' | 'Update',
        includeId: boolean,
    ): OptionalKind<PropertySignatureStructure>[] {
        const props: OptionalKind<PropertySignatureStructure>[] = []
        if (includeId) {
            props.push({ name: 'id', type: 'number', hasQuestionToken: true })
        }
        for (const attr of type.attributes) {
            props.push({
                name: attr.name,
                type: this.transformer.toTypeScript(attr.type, attr.required),
                hasQuestionToken: mode === 'Update' || !attr.required,
                ...this.docsFor(attr),
            })
        }
        for (const mediaField of type.media) {
            props.push({
                name: mediaField.name,
                type: mediaField.multiple ? 'MultiMediaInput' : 'MediaInput',
                hasQuestionToken: true,
            })
        }
        for (const rel of type.relations) {
            props.push({
                name: rel.name,
                type: 'RelationInput',
                hasQuestionToken: true,
            })
        }
        for (const compField of type.components) {
            const inner = `${compField.componentType}${mode}Input`
            const compType = compField.repeatable ? `${inner}[]` : inner
            props.push({
                name: compField.name,
                type: `${compType} | null`,
                hasQuestionToken: true,
            })
        }
        for (const dzField of type.dynamicZones) {
            props.push({
                name: dzField.name,
                type: `(${dzField.componentTypes.map(ct => `${ct}Dz${mode}Input`).join(' | ')})[] | null`,
                hasQuestionToken: true,
            })
        }
        return props
    }

    private addContentTypeInterface(
        sf: SourceFile,
        contentType: ContentType,
    ): void {
        sf.addInterface({
            name: contentType.cleanName,
            isExported: true,
            properties: [
                {
                    name: '__typename',
                    type: `'${contentType.cleanName}'`,
                    isReadonly: true,
                    hasQuestionToken: true,
                },
                { name: 'id', type: 'number' },
                { name: 'documentId', type: 'string' },
                { name: 'createdAt', type: 'string' },
                { name: 'updatedAt', type: 'string' },
                { name: 'publishedAt', type: 'string | null' },
                ...contentType.attributes.map(attr => ({
                    name: attr.name,
                    type: this.transformer.toTypeScript(
                        attr.type,
                        attr.required,
                    ),
                    ...this.docsFor(attr),
                })),
            ],
        })
    }

    private addInputTypeInterfaces(
        sf: SourceFile,
        contentType: ContentType,
    ): void {
        for (const mode of ['Create', 'Update'] as const) {
            sf.addInterface({
                name: `${contentType.cleanName}${mode}Input`,
                docs: [`${mode} input for ${contentType.cleanName}`],
                isExported: true,
                properties: this.buildInputProperties(contentType, mode, false),
            })
        }
    }

    private addPopulateParams(sf: SourceFile, schema: ParsedSchema): void {
        sf.addStatements([
            '// ============================================',
            '// PopulateParam types for type-safe populate',
            '// ============================================',
        ])

        // Generate for components with populatable fields
        for (const component of schema.components) {
            const typeBody = this.buildPopulateParamTypeBody(component)
            if (typeBody) {
                sf.addTypeAlias({
                    name: `${component.cleanName}PopulateParam`,
                    isExported: true,
                    type: typeBody,
                })
            }
        }

        // Generate for content types with populatable fields
        for (const contentType of schema.contentTypes) {
            const typeBody = this.buildPopulateParamTypeBody(contentType)
            if (typeBody) {
                sf.addTypeAlias({
                    name: `${contentType.cleanName}PopulateParam`,
                    isExported: true,
                    type: typeBody,
                })
            }
        }
    }

    private buildPopulateParamTypeBody(
        type: ContentType | Component,
    ): string | null {
        const fields: string[] = []

        for (const rel of type.relations) {
            const t = rel.targetType
            const targetHasPopulate = this.hasPopulatableFields(t)
            const options = [`fields?: _EntityField<${t}>[]`]
            if (targetHasPopulate) {
                options.push(
                    `populate?: ${t}PopulateParam | (keyof ${t}PopulateParam & string)[] | '*'`,
                )
            }
            options.push(`filters?: ${t}Filters`)
            options.push(`sort?: _SortValue<${t}> | _SortValue<${t}>[]`)
            options.push(`limit?: number`)
            options.push(`start?: number`)
            fields.push(`  ${rel.name}?: true | { ${options.join('; ')} }`)
        }

        for (const media of type.media) {
            fields.push(
                `  ${media.name}?: true | { fields?: (keyof MediaFile & string)[] }`,
            )
        }

        for (const comp of type.components) {
            const t = comp.componentType
            const targetHasPopulate = this.hasPopulatableFields(t)
            const options = [`fields?: (keyof ${t} & string)[]`]
            if (targetHasPopulate) {
                options.push(
                    `populate?: ${t}PopulateParam | (keyof ${t}PopulateParam & string)[] | '*'`,
                )
            }
            fields.push(`  ${comp.name}?: true | { ${options.join('; ')} }`)
        }

        for (const dz of type.dynamicZones) {
            const onEntries: string[] = []
            for (let i = 0; i < dz.components.length; i++) {
                const uid = dz.components[i]
                const cleanType = dz.componentTypes[i]
                const hasPopulate = this.hasPopulatableFields(cleanType)
                const options = [`fields?: (keyof ${cleanType} & string)[]`]
                if (hasPopulate) {
                    options.push(
                        `populate?: ${cleanType}PopulateParam | (keyof ${cleanType}PopulateParam & string)[] | '*'`,
                    )
                }
                onEntries.push(`'${uid}'?: true | { ${options.join('; ')} }`)
            }
            fields.push(
                `  ${dz.name}?: true | { on?: { ${onEntries.join('; ')} } }`,
            )
        }

        if (fields.length === 0) return null

        return `{\n${fields.join('\n')}\n}`
    }

    private addPayloadUtilityTypes(sf: SourceFile, schema: ParsedSchema): void {
        sf.addStatements(`// Prisma-like Payload types for populate support
// These types allow type-safe population of relations
//
// Usage example:
// type ItemWithCategory = ItemGetPayload<{ populate: { category: true } }>
// const items = await strapi.items.find({ populate: { category: true } }) as ItemWithCategory[]
//
// This ensures that relations are only included in the type when populate is used`)

        // Generate GetPayload type for each component with populatable fields
        for (const component of schema.components) {
            if (this.hasAnyPopulatableFields(component)) {
                sf.addStatements(this.buildGetPayloadType(component))
            }
        }

        // Generate GetPayload type for each content type with populatable fields
        for (const contentType of schema.contentTypes) {
            if (this.hasAnyPopulatableFields(contentType)) {
                sf.addStatements(this.buildGetPayloadType(contentType))
            }
        }
    }

    private buildGetPayloadType(type: ContentType | Component): string {
        const name = type.cleanName

        if (!this.hasAnyPopulatableFields(type)) {
            return `export type ${name}GetPayload<P extends { populate?: unknown } = {}> = ${name} & {}`
        }

        const allPopFields = this.buildAllPopulatedFields(type)
        const arrayPopFields = this.buildArrayPopulatedFields(type)
        const perFieldPop = this.buildPerFieldPopulate(type)

        return `// Payload type for ${name} with populate support
export type ${name}GetPayload<P extends { populate?: unknown } = {}> =
  ${name} &
  (P extends { populate: infer Pop }
    ? Pop extends '*' | true
      ? {
${allPopFields}
        }
      : Pop extends readonly (infer _)[]
        ? {
${arrayPopFields}
          }
        : {
${perFieldPop}
          }
    : {})`
    }

    /**
     * Build fields for populate: '*' | true — all populatable fields with base types
     */
    private buildAllPopulatedFields(type: ContentType | Component): string {
        const fields: string[] = []

        for (const rel of type.relations) {
            const isNullable =
                rel.relationType === 'oneToOne' ||
                rel.relationType === 'manyToOne'
            const isArray =
                rel.relationType === 'oneToMany' ||
                rel.relationType === 'manyToMany'
            const nullSuffix = isNullable ? ' | null' : ''
            const arraySuffix = isArray ? '[]' : ''
            fields.push(
                `          ${rel.name}?: ${rel.targetType}${arraySuffix}${nullSuffix}`,
            )
        }

        for (const mediaField of type.media) {
            const mediaType = mediaField.multiple ? 'MediaFile[]' : 'MediaFile'
            fields.push(`          ${mediaField.name}?: ${mediaType}`)
        }

        for (const componentField of type.components) {
            const arraySuffix = componentField.repeatable ? '[]' : ''
            fields.push(
                `          ${componentField.name}?: ${componentField.componentType}${arraySuffix}`,
            )
        }

        for (const dzField of type.dynamicZones) {
            const unionType = dzField.componentTypes
                .map(ct => `${ct}Dz`)
                .join(' | ')
            fields.push(`          ${dzField.name}?: (${unionType})[]`)
        }

        return fields.join('\n')
    }

    /**
     * Build fields for array-style populate (e.g. populate: ['category', 'image'])
     */
    private buildArrayPopulatedFields(type: ContentType | Component): string {
        const fields: string[] = []

        for (const rel of type.relations) {
            const isNullable =
                rel.relationType === 'oneToOne' ||
                rel.relationType === 'manyToOne'
            const isArray =
                rel.relationType === 'oneToMany' ||
                rel.relationType === 'manyToMany'
            const nullSuffix = isNullable ? ' | null' : ''
            const arraySuffix = isArray ? '[]' : ''
            fields.push(
                `            ${rel.name}?: '${rel.name}' extends Pop[number] ? ${rel.targetType}${arraySuffix}${nullSuffix} : never`,
            )
        }

        for (const mediaField of type.media) {
            const mediaType = mediaField.multiple ? 'MediaFile[]' : 'MediaFile'
            fields.push(
                `            ${mediaField.name}?: '${mediaField.name}' extends Pop[number] ? ${mediaType} : never`,
            )
        }

        for (const componentField of type.components) {
            const arraySuffix = componentField.repeatable ? '[]' : ''
            fields.push(
                `            ${componentField.name}?: '${componentField.name}' extends Pop[number] ? ${componentField.componentType}${arraySuffix} : never`,
            )
        }

        for (const dzField of type.dynamicZones) {
            const unionType = dzField.componentTypes
                .map(ct => `${ct}Dz`)
                .join(' | ')
            fields.push(
                `            ${dzField.name}?: '${dzField.name}' extends Pop[number] ? (${unionType})[] : never`,
            )
        }

        return fields.join('\n')
    }

    /**
     * Build per-field conditional populate for object-style populate params
     */
    private buildPerFieldPopulate(type: ContentType | Component): string {
        const fields: string[] = []

        for (const rel of type.relations) {
            const isNullable =
                rel.relationType === 'oneToOne' ||
                rel.relationType === 'manyToOne'
            const isArray =
                rel.relationType === 'oneToMany' ||
                rel.relationType === 'manyToMany'
            const baseType = rel.targetType
            const nullSuffix = isNullable ? ' | null' : ''
            const arraySuffix = isArray ? '[]' : ''
            const hasPopulate = this.hasPopulatableFields(baseType)

            const resolvedType = hasPopulate
                ? `_ApplyFields<Pop['${rel.name}'] extends { populate: infer NestedPop } ? ${baseType}GetPayload<{ populate: NestedPop }> : ${baseType}, ${baseType}, Pop['${rel.name}']>${arraySuffix}${nullSuffix}`
                : `_ApplyFields<${baseType}, ${baseType}, Pop['${rel.name}']>${arraySuffix}${nullSuffix}`

            fields.push(
                `          ${rel.name}?: '${rel.name}' extends keyof Pop\n            ? ${resolvedType}\n            : never`,
            )
        }

        for (const mediaField of type.media) {
            const arraySuffix = mediaField.multiple ? '[]' : ''
            fields.push(
                `          ${mediaField.name}?: '${mediaField.name}' extends keyof Pop ? _ApplyFields<MediaFile, MediaFile, Pop['${mediaField.name}']>${arraySuffix} : never`,
            )
        }

        for (const componentField of type.components) {
            const baseType = componentField.componentType
            const arraySuffix = componentField.repeatable ? '[]' : ''
            const hasPopulate = this.hasPopulatableFields(baseType)

            const resolvedType = hasPopulate
                ? `_ApplyFields<Pop['${componentField.name}'] extends { populate: infer NestedPop } ? ${baseType}GetPayload<{ populate: NestedPop }> : ${baseType}, ${baseType}, Pop['${componentField.name}']>${arraySuffix}`
                : `_ApplyFields<${baseType}, ${baseType}, Pop['${componentField.name}']>${arraySuffix}`

            fields.push(
                `          ${componentField.name}?: '${componentField.name}' extends keyof Pop\n            ? ${resolvedType}\n            : never`,
            )
        }

        for (const dzField of type.dynamicZones) {
            const componentEntries: string[] = []
            for (let i = 0; i < dzField.components.length; i++) {
                const uid = dzField.components[i]
                const cleanType = dzField.componentTypes[i]
                const dzVariant = `${cleanType}Dz`
                const hasPopulate = this.hasPopulatableFields(cleanType)

                if (hasPopulate) {
                    // Extract nested populate from on discriminator and recursively apply GetPayload.
                    // Populated branch: GetPayload result is intersected with the __component
                    // discriminator so the resulting union still narrows in switch statements.
                    componentEntries.push(
                        `(Pop['${dzField.name}'] extends { on: infer On } ? '${uid}' extends keyof On ? On['${uid}'] extends { populate: infer NestedPop } ? (${cleanType}GetPayload<{ populate: NestedPop }> & { __component: '${uid}' }) : ${dzVariant} : ${dzVariant} : ${dzVariant})`,
                    )
                } else {
                    componentEntries.push(dzVariant)
                }
            }
            const dzType = `(${componentEntries.join(' | ')})[]`
            fields.push(
                `          ${dzField.name}?: '${dzField.name}' extends keyof Pop ? ${dzType} : never`,
            )
        }

        return fields.join('\n')
    }

    private hasAnyPopulatableFields(type: ContentType | Component): boolean {
        return (
            type.relations.length > 0 ||
            type.media.length > 0 ||
            type.components.length > 0 ||
            type.dynamicZones.length > 0
        )
    }

    /**
     * Check if a type (by name) has populatable fields (relations, media, components, or dynamic zones)
     */
    private hasPopulatableFields(typeName: string): boolean {
        if (!this.schema) return false

        // Check in content types
        const contentType = this.schema.contentTypes.find(
            ct => ct.cleanName === typeName,
        )
        if (contentType) {
            return this.hasAnyPopulatableFields(contentType)
        }

        // Check in components
        const component = this.schema.components.find(
            comp => comp.cleanName === typeName,
        )
        if (component) {
            return this.hasAnyPopulatableFields(component)
        }

        return false
    }
}
