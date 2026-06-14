import { describe, it, expect } from 'vitest'
import { TypesGenerator } from '../../../src/generator/types-generator.js'
import type {
    ParsedSchema,
    ContentType,
    Component,
} from '../../../src/schema-types.js'

// ------------------------------------------------------------------
// Mock schema
// ------------------------------------------------------------------

const mockComponents: Component[] = [
    {
        name: 'ProjectConfig',
        cleanName: 'ProjectConfig',
        category: 'project',
        uid: 'project.project-config',
        attributes: [
            { name: 'key', type: { kind: 'string' }, required: true },
            { name: 'value', type: { kind: 'string' }, required: true },
        ],
        relations: [],
        media: [],
        components: [],
        dynamicZones: [],
    },
    {
        name: 'LandingHero',
        cleanName: 'LandingHero',
        category: 'landing',
        uid: 'landing.hero',
        attributes: [
            { name: 'title', type: { kind: 'string' }, required: true },
        ],
        relations: [],
        media: [{ name: 'image', multiple: false, required: true }],
        components: [],
        dynamicZones: [],
    },
    {
        name: 'LandingFeature',
        cleanName: 'LandingFeature',
        category: 'landing',
        uid: 'landing.feature',
        attributes: [
            { name: 'label', type: { kind: 'string' }, required: true },
        ],
        relations: [
            {
                name: 'item',
                relationType: 'manyToOne',
                target: 'api::item.item',
                targetType: 'Item',
                required: false,
            },
        ],
        media: [],
        components: [],
        dynamicZones: [],
    },
]

const mockContentTypes: ContentType[] = [
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
        name: 'ApiProjectProject',
        cleanName: 'Project',
        collectionName: 'projects',
        singularName: 'project',
        pluralName: 'projects',
        kind: 'collection',
        attributes: [
            { name: 'title', type: { kind: 'string' }, required: true },
        ],
        relations: [
            {
                name: 'items',
                relationType: 'oneToMany',
                target: 'api::item.item',
                targetType: 'Item',
                required: false,
            },
            {
                name: 'owner',
                relationType: 'manyToOne',
                target: 'plugin::users-permissions.user',
                targetType: 'User',
                required: false,
            },
        ],
        media: [{ name: 'images', multiple: true, required: false }],
        components: [
            {
                name: 'config',
                component: 'project.config',
                componentType: 'ProjectConfig',
                repeatable: true,
                required: false,
            },
        ],
        dynamicZones: [
            {
                name: 'sections',
                components: ['landing.hero', 'landing.feature'],
                componentTypes: ['LandingHero', 'LandingFeature'],
                required: false,
            },
        ],
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
        relations: [
            {
                name: 'projects',
                relationType: 'oneToMany',
                target: 'api::project.project',
                targetType: 'Project',
                required: false,
            },
        ],
        media: [],
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
]

const mockSchema: ParsedSchema = {
    contentTypes: mockContentTypes,
    components: mockComponents,
}

// Generate output once for all tests
const generator = new TypesGenerator()
const output = generator.generate(mockSchema)

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('TypesGenerator', () => {
    // ================================================================
    // Helper types
    // ================================================================
    describe('Helper types', () => {
        it('should generate _EntityField helper type', () => {
            expect(output).toContain(
                "type _EntityField<T> = Exclude<keyof T & string, '__typename'>",
            )
        })

        it('should generate _SortValue helper type', () => {
            expect(output).toContain(
                'type _SortValue<T> = _EntityField<T> | `${_EntityField<T>}:${"asc" | "desc"}`',
            )
        })

        it('should generate _ApplyFields helper type', () => {
            expect(output).toContain(
                "type _ApplyFields<TFull, TBase, TEntry> = TEntry extends true ? TFull : TEntry extends { fields: readonly (infer F extends string)[] } ? Pick<TBase, Extract<F | 'id' | 'documentId', keyof TBase>> & Omit<TFull, keyof TBase> : TFull",
            )
        })
    })

    // ================================================================
    // Base types
    // ================================================================
    describe('Base types', () => {
        it('should generate MediaFile interface', () => {
            expect(output).toContain('export interface MediaFile {')
            expect(output).toContain('  id: number')
            expect(output).toContain('  name: string')
            expect(output).toContain('  url: string')
            expect(output).toContain('  mime: string')
            expect(output).toContain(
                '  focalPoint: { x: number; y: number } | null',
            )
            expect(output).toContain('  width: number | null')
            expect(output).toContain('  height: number | null')
            expect(output).toContain('  alternativeText: string | null')
            expect(output).toContain('  formats: BaseMediaFormats | null')
        })

        it('should generate BaseMediaFormats interface with default responsive keys and open index signature', () => {
            expect(output).toContain('export interface BaseMediaFormats {')
            expect(output).toContain('  thumbnail?: MediaFormat')
            expect(output).toContain('  small?: MediaFormat')
            expect(output).toContain('  medium?: MediaFormat')
            expect(output).toContain('  large?: MediaFormat')
            expect(output).toContain('  [key: string]: MediaFormat | undefined')
        })

        it('should type ImageBlock.image.formats as BaseMediaFormats', () => {
            expect(output).toContain('formats?: BaseMediaFormats')
        })

        it('should generate BlocksContent type', () => {
            expect(output).toContain('export type BlocksContent = Block[]')
            expect(output).toContain('export type Block =')
            expect(output).toContain('ParagraphBlock')
            expect(output).toContain('HeadingBlock')
            expect(output).toContain('ImageBlock')
        })

        it('should generate StrapiID helper type for documentId/id-accepting inputs', () => {
            expect(output).toContain('export type StrapiID = string | number')
        })

        it('should generate RelationOperations interface with connect/disconnect/set', () => {
            expect(output).toContain('export interface RelationOperations {')
            expect(output).toContain('connect?:')
            expect(output).toContain('disconnect?: StrapiID[]')
            expect(output).toContain('set?: StrapiID[]')
        })

        it('should generate RelationInput union with scalar, array, and operations forms', () => {
            expect(output).toContain(
                'export type RelationInput = StrapiID | StrapiID[] | RelationOperations | null',
            )
        })

        it('should generate MediaInput and MultiMediaInput aliases', () => {
            expect(output).toContain('export type MediaInput = StrapiID | null')
            expect(output).toContain(
                'export type MultiMediaInput = StrapiID[] | null',
            )
        })
    })

    // ================================================================
    // Content type interfaces
    // ================================================================
    describe('Content type interfaces', () => {
        it('should generate Category interface with __typename and base fields', () => {
            expect(output).toContain('export interface Category {')
            expect(output).toContain("  readonly __typename?: 'Category'")
            expect(output).toContain('  id: number')
            expect(output).toContain('  documentId: string')
            expect(output).toContain('  createdAt: string')
            expect(output).toContain('  updatedAt: string')
            expect(output).toContain('  publishedAt: string | null')
            expect(output).toContain('  name: string')
        })

        it('should generate Item interface with relation as { id, documentId } | null', () => {
            expect(output).toContain('export interface Item {')
            expect(output).toContain("  readonly __typename?: 'Item'")
            expect(output).toContain('  title: string')
            expect(output).toContain('  price: number | null')
        })

        it('should generate Project interface with oneToMany relation as array', () => {
            expect(output).toContain('export interface Project {')
            expect(output).toContain("  readonly __typename?: 'Project'")
            expect(output).toContain('  title: string')
        })

        it('should generate Homepage single type interface', () => {
            expect(output).toContain('export interface Homepage {')
            expect(output).toContain("  readonly __typename?: 'Homepage'")
            expect(output).toContain('  heading: string')
        })
    })

    // ================================================================
    // Component interfaces
    // ================================================================
    describe('Component interfaces', () => {
        it('should generate ProjectConfig regular component WITHOUT __component (Strapi rejects it on regular component attributes)', () => {
            expect(output).toContain('export interface ProjectConfig {')
            expect(output).toContain('  id: number')
            expect(output).toContain('  key: string')
            expect(output).toContain('  value: string')
            // ProjectConfig is used as a regular component (Project.config), not in any DZ.
            // No __component anywhere — and no Dz alias should be generated either.
            expect(output).not.toMatch(
                /interface ProjectConfig \{[^}]*__component/,
            )
            expect(output).not.toContain('export type ProjectConfigDz')
        })

        it('should generate LandingHero base component WITHOUT __component', () => {
            expect(output).toContain('export interface LandingHero {')
            expect(output).toContain('  id: number')
            expect(output).toContain('  title: string')
            expect(output).not.toMatch(
                /interface LandingHero \{[^}]*__component/,
            )
            // Media fields are only available via GetPayload populate, not in base interface
            expect(output).not.toMatch(/interface LandingHero \{[^}]*image/)
        })

        it('should generate LandingHeroDz alias for DZ usage with __component discriminator', () => {
            expect(output).toContain(
                "export type LandingHeroDz = LandingHero & { __component: 'landing.hero' }",
            )
        })

        it('should generate LandingFeatureDz alias for DZ usage with __component discriminator', () => {
            expect(output).toContain(
                "export type LandingFeatureDz = LandingFeature & { __component: 'landing.feature' }",
            )
        })
    })

    // ================================================================
    // Input types
    // ================================================================
    describe('Input types (Create / Update split)', () => {
        it('CreateInput enforces a required scalar; UpdateInput is fully partial', () => {
            expect(output).toContain('export interface CategoryCreateInput {')
            expect(output).toContain('  name: string') // required in Create
            expect(output).toContain('export interface CategoryUpdateInput {')
            expect(output).toContain('  name?: string') // optional in Update
        })

        it('ItemCreateInput: required scalar enforced, optional nullable, media/relation optional', () => {
            expect(output).toContain('export interface ItemCreateInput {')
            expect(output).toContain('  title: string') // required
            expect(output).toContain('  price?: number | null') // optional scalar
            expect(output).toContain('  image?: MediaInput')
            expect(output).toContain('  category?: RelationInput')
            expect(output).toContain('export interface ItemUpdateInput {')
            expect(output).toContain('  title?: string') // partial in Update
        })

        it('ProjectInput: multi-media, relations, and component field uses the matching variant', () => {
            expect(output).toContain('export interface ProjectCreateInput {')
            expect(output).toContain('  images?: MultiMediaInput')
            expect(output).toContain('  items?: RelationInput')
            expect(output).toContain('  owner?: RelationInput')
            expect(output).toContain(
                '  config?: ProjectConfigCreateInput[] | null',
            )
            expect(output).toContain(
                '  config?: ProjectConfigUpdateInput[] | null',
            )
        })

        it('ProjectConfigCreateInput has no __component (regular component, not DZ)', () => {
            expect(output).toContain(
                'export interface ProjectConfigCreateInput {',
            )
            expect(output).toContain('  id?: number')
            expect(output).toContain('  key: string') // required scalar
            expect(output).not.toMatch(
                /interface ProjectConfigCreateInput \{[^}]*__component/,
            )
            expect(output).not.toContain(
                'export type ProjectConfigDzCreateInput',
            )
        })

        it('generates Dz Create/Update aliases for DZ payloads', () => {
            expect(output).toContain(
                "export type LandingHeroDzCreateInput = LandingHeroCreateInput & { __component: 'landing.hero' }",
            )
            expect(output).toContain(
                "export type LandingHeroDzUpdateInput = LandingHeroUpdateInput & { __component: 'landing.hero' }",
            )
            expect(output).toContain(
                "export type LandingFeatureDzCreateInput = LandingFeatureCreateInput & { __component: 'landing.feature' }",
            )
        })

        it('DZ field uses the *DzCreateInput / *DzUpdateInput unions', () => {
            expect(output).toMatch(
                /sections\?: \(LandingHeroDzCreateInput \| LandingFeatureDzCreateInput\)\[\] \| null/,
            )
            expect(output).toMatch(
                /sections\?: \(LandingHeroDzUpdateInput \| LandingFeatureDzUpdateInput\)\[\] \| null/,
            )
        })
    })

    // ================================================================
    // PopulateParam types
    // ================================================================
    describe('PopulateParam types', () => {
        it('should NOT generate PopulateParam for Category (no populatable fields)', () => {
            expect(output).not.toContain('export type CategoryPopulateParam')
        })

        it('should generate ItemPopulateParam with relation and media entries', () => {
            expect(output).toContain('export type ItemPopulateParam = {')
            expect(output).toContain('  category?: true | {')
            expect(output).toContain(
                '  image?: true | { fields?: (keyof MediaFile & string)[] }',
            )
        })

        it('should generate ProjectPopulateParam with relation, media, component, and dynamic zone entries', () => {
            expect(output).toContain('export type ProjectPopulateParam = {')
            expect(output).toContain('  items?: true | {')
            expect(output).toContain('  owner?: true | {')
            expect(output).toContain(
                '  images?: true | { fields?: (keyof MediaFile & string)[] }',
            )
            expect(output).toContain('  config?: true | {')
            expect(output).toContain('  sections?: true | { on?: {')
        })

        it('PopulateParam relation should have fields, populate, filters, sort, limit, start options', () => {
            expect(output).toContain('fields?: _EntityField<Category>[]')
            expect(output).toContain('filters?: CategoryFilters')
            expect(output).toContain(
                'sort?: _SortValue<Category> | _SortValue<Category>[]',
            )
            expect(output).toContain('limit?: number')
            expect(output).toContain('start?: number')
        })

        it('PopulateParam media should have true | { fields?: (keyof MediaFile & string)[] }', () => {
            expect(output).toContain(
                'image?: true | { fields?: (keyof MediaFile & string)[] }',
            )
        })

        it('PopulateParam component should have fields and populate options', () => {
            expect(output).toContain(
                'config?: true | { fields?: (keyof ProjectConfig & string)[]',
            )
        })

        it('PopulateParam dynamic zone should have on fragment syntax with component UIDs', () => {
            expect(output).toContain('sections?: true | { on?: {')
            expect(output).toContain("'landing.hero'?:")
            expect(output).toContain("'landing.feature'?:")
        })

        it('should generate UserPopulateParam for User type', () => {
            expect(output).toContain('export type UserPopulateParam = {')
            expect(output).toContain('  projects?: true | {')
        })
    })

    // ================================================================
    // GetPayload types
    // ================================================================
    describe('GetPayload types', () => {
        it('should NOT generate GetPayload for Category (no populatable fields)', () => {
            expect(output).not.toContain('CategoryGetPayload')
        })

        it('should generate ItemGetPayload with populate support', () => {
            expect(output).toContain(
                'export type ItemGetPayload<P extends { populate?: unknown } = {}> =',
            )
            expect(output).toContain('Item &')
        })

        it("GetPayload should have branch for Pop extends '*' | true (all fields)", () => {
            expect(output).toContain("Pop extends '*' | true")
        })

        it('GetPayload should have branch for Pop extends readonly array', () => {
            expect(output).toContain('Pop extends readonly (infer _)[]')
        })

        it('GetPayload should have branch for per-field object populate', () => {
            expect(output).toContain("category?: 'category' extends keyof Pop")
            expect(output).toContain("image?: 'image' extends keyof Pop")
        })

        it('Per-field populate should use _ApplyFields wrapper', () => {
            expect(output).toContain('_ApplyFields<Category, Category,')
            expect(output).toContain('_ApplyFields<MediaFile, MediaFile,')
        })

        it('Array populate should check field extends Pop[number]', () => {
            expect(output).toContain(
                "'category' extends Pop[number] ? Category",
            )
            expect(output).toContain("'image' extends Pop[number] ? MediaFile")
        })
    })

    // ================================================================
    // Component GetPayload types
    // ================================================================
    describe('Component GetPayload types', () => {
        it('should generate LandingHeroGetPayload for component with media', () => {
            expect(output).toContain(
                'export type LandingHeroGetPayload<P extends { populate?: unknown } = {}> =',
            )
            expect(output).toContain('LandingHero &')
        })

        it('should generate LandingFeatureGetPayload for component with relation', () => {
            expect(output).toContain(
                'export type LandingFeatureGetPayload<P extends { populate?: unknown } = {}> =',
            )
            expect(output).toContain('LandingFeature &')
        })
    })

    // ================================================================
    // Dynamic zone populate.on support
    // ================================================================
    describe('Dynamic zone populate.on support', () => {
        it('should resolve nested populate from on discriminator for components with populatable fields', () => {
            // LandingFeature has a relation (item), so it should have nested populate via on
            expect(output).toContain("Pop['sections'] extends { on: infer On }")
            expect(output).toContain("'landing.feature' extends keyof On")
            expect(output).toContain(
                "On['landing.feature'] extends { populate: infer NestedPop }",
            )
            expect(output).toContain(
                'LandingFeatureGetPayload<{ populate: NestedPop }>',
            )
        })

        it('populated DZ branch must intersect GetPayload with __component to keep discriminated-union narrowing', () => {
            expect(output).toContain(
                "LandingFeatureGetPayload<{ populate: NestedPop }> & { __component: 'landing.feature' }",
            )
            expect(output).toContain(
                "LandingHeroGetPayload<{ populate: NestedPop }> & { __component: 'landing.hero' }",
            )
        })

        it('non-populated DZ branches should fall back to *Dz alias (already carries __component)', () => {
            // Inside the per-field DZ branch, both the "no nested populate" and
            // the "uid not in On" fallback must use *Dz, not the bare base type.
            expect(output).toContain('LandingHeroDz')
            expect(output).toContain('LandingFeatureDz')
        })

        it('should resolve nested populate from on discriminator for components with media', () => {
            // LandingHero has media (image), so it should also have nested populate via on
            expect(output).toContain("'landing.hero' extends keyof On")
            expect(output).toContain(
                "On['landing.hero'] extends { populate: infer NestedPop }",
            )
            expect(output).toContain(
                'LandingHeroGetPayload<{ populate: NestedPop }>',
            )
        })
    })

    // ================================================================
    // Constraint JSDoc & defaults
    // ================================================================
    describe('Constraint JSDoc & defaults', () => {
        // Grab a single interface body by its exact header, up to the next
        // top-level `export` — lets us assert read vs input separately.
        const sliceInterface = (src: string, header: string): string => {
            const start = src.indexOf(header)
            if (start === -1) return ''
            const next = src.indexOf('\nexport ', start + header.length)
            return src.slice(start, next === -1 ? undefined : next)
        }

        const constrainedSchema: ParsedSchema = {
            contentTypes: [
                {
                    name: 'ApiProductProduct',
                    cleanName: 'Product',
                    collectionName: 'products',
                    singularName: 'product',
                    pluralName: 'products',
                    kind: 'collection',
                    attributes: [
                        {
                            name: 'quantity',
                            type: { kind: 'integer' },
                            required: false,
                            constraints: { min: 0, max: 100 },
                        },
                        {
                            name: 'slug',
                            type: { kind: 'string' },
                            required: true,
                            constraints: { minLength: 3, regex: '^[a-z-]+$' },
                        },
                        {
                            name: 'status',
                            type: { kind: 'string' },
                            required: false,
                            defaultValue: 'draft',
                        },
                        {
                            name: 'featured',
                            type: { kind: 'boolean' },
                            required: false,
                            defaultValue: false,
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

        const constrainedOutput = new TypesGenerator().generate(
            constrainedSchema,
        )

        it('attaches constraint JSDoc to read-type properties', () => {
            const read = sliceInterface(
                constrainedOutput,
                'export interface Product {',
            )
            expect(read).toContain('@minimum 0')
            expect(read).toContain('@maximum 100')
            expect(read).toContain('@minLength 3')
            expect(read).toContain('@pattern ^[a-z-]+$')
        })

        it('attaches constraint JSDoc to input-type properties', () => {
            const input = sliceInterface(
                constrainedOutput,
                'export interface ProductCreateInput {',
            )
            expect(input).toContain('@minimum 0')
            expect(input).toContain('@maximum 100')
            expect(input).toContain('@minLength 3')
            expect(input).toContain('@pattern ^[a-z-]+$')
        })

        it('emits a *Defaults const for content types with defaults', () => {
            expect(constrainedOutput).toContain(
                'export const ProductDefaults = { status: "draft", featured: false } as const satisfies Partial<ProductCreateInput>',
            )
        })

        it('emits *Defaults and *DzDefaults for components (DZ form carries __component)', () => {
            const schema: ParsedSchema = {
                contentTypes: [
                    {
                        name: 'ApiPagePage',
                        cleanName: 'Page',
                        collectionName: 'pages',
                        singularName: 'page',
                        pluralName: 'pages',
                        kind: 'collection',
                        attributes: [],
                        relations: [],
                        media: [],
                        components: [],
                        dynamicZones: [
                            {
                                name: 'blocks',
                                components: ['landing.hero'],
                                componentTypes: ['LandingHero'],
                                required: false,
                            },
                        ],
                    },
                ],
                components: [
                    {
                        name: 'LandingHero',
                        cleanName: 'LandingHero',
                        category: 'landing',
                        uid: 'landing.hero',
                        attributes: [
                            {
                                name: 'title',
                                type: { kind: 'string' },
                                required: false,
                                defaultValue: 'Hello',
                            },
                        ],
                        relations: [],
                        media: [],
                        components: [],
                        dynamicZones: [],
                    },
                ],
            }

            const out = new TypesGenerator().generate(schema)
            expect(out).toContain(
                'export const LandingHeroDefaults = { title: "Hello" } as const satisfies Partial<LandingHeroCreateInput>',
            )
            expect(out).toContain(
                'export const LandingHeroDzDefaults = { __component: "landing.hero", title: "Hello" } as const satisfies Partial<LandingHeroDzCreateInput>',
            )
        })
    })
})
