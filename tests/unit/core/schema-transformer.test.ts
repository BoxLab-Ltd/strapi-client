import { describe, it, expect } from 'vitest'
import {
    transformSchema,
    ExtractedSchema,
    StrapiContentType,
    StrapiComponent,
} from '../../../src/core/schema-transformer.js'

describe('Schema Transformer', () => {
    describe('transformSchema', () => {
        it('should transform empty schema', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {},
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes).toHaveLength(0)
            expect(result.components).toHaveLength(0)
        })

        it('should transform a simple content type', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::item.item': {
                        uid: 'api::item.item',
                        kind: 'collectionType',
                        collectionName: 'items',
                        info: {
                            singularName: 'item',
                            pluralName: 'items',
                            displayName: 'Item',
                        },
                        attributes: {
                            title: { type: 'string', required: true },
                            description: { type: 'text' },
                            count: { type: 'integer' },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes).toHaveLength(1)
            expect(result.contentTypes[0].cleanName).toBe('Item')
            expect(result.contentTypes[0].kind).toBe('collection')
            expect(result.contentTypes[0].collectionName).toBe('items')
            expect(result.contentTypes[0].singularName).toBe('item')
            expect(result.contentTypes[0].pluralName).toBe('items')
            expect(result.contentTypes[0].attributes).toHaveLength(3)

            // Check attribute transformation
            const titleAttr = result.contentTypes[0].attributes.find(
                a => a.name === 'title',
            )
            expect(titleAttr).toBeDefined()
            expect(titleAttr!.required).toBe(true)
            expect(titleAttr!.type.kind).toBe('string')
        })

        it('should transform single type', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::homepage.homepage': {
                        uid: 'api::homepage.homepage',
                        kind: 'singleType',
                        collectionName: 'homepages',
                        info: {
                            singularName: 'homepage',
                            pluralName: 'homepages',
                            displayName: 'Homepage',
                        },
                        attributes: {
                            heroTitle: { type: 'string', required: true },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes).toHaveLength(1)
            expect(result.contentTypes[0].kind).toBe('single')
        })

        it('should transform relations', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::post.post': {
                        uid: 'api::post.post',
                        kind: 'collectionType',
                        collectionName: 'posts',
                        info: {
                            singularName: 'post',
                            pluralName: 'posts',
                            displayName: 'Post',
                        },
                        attributes: {
                            author: {
                                type: 'relation',
                                relation: 'manyToOne',
                                target: 'plugin::users-permissions.user',
                            },
                            categories: {
                                type: 'relation',
                                relation: 'manyToMany',
                                target: 'api::category.category',
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes[0].relations).toHaveLength(2)

            const authorRel = result.contentTypes[0].relations.find(
                r => r.name === 'author',
            )
            expect(authorRel).toBeDefined()
            expect(authorRel!.relationType).toBe('manyToOne')
            expect(authorRel!.targetType).toBe('User')

            const categoriesRel = result.contentTypes[0].relations.find(
                r => r.name === 'categories',
            )
            expect(categoriesRel).toBeDefined()
            expect(categoriesRel!.relationType).toBe('manyToMany')
            expect(categoriesRel!.targetType).toBe('Category')
        })

        it('should skip admin relations', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::post.post': {
                        uid: 'api::post.post',
                        kind: 'collectionType',
                        collectionName: 'posts',
                        info: {
                            singularName: 'post',
                            pluralName: 'posts',
                            displayName: 'Post',
                        },
                        attributes: {
                            createdBy: {
                                type: 'relation',
                                relation: 'oneToOne',
                                target: 'admin::user',
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes[0].relations).toHaveLength(0)
        })

        it('should transform media fields', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::article.article': {
                        uid: 'api::article.article',
                        kind: 'collectionType',
                        collectionName: 'articles',
                        info: {
                            singularName: 'article',
                            pluralName: 'articles',
                            displayName: 'Article',
                        },
                        attributes: {
                            cover: {
                                type: 'media',
                                multiple: false,
                                required: true,
                            },
                            gallery: {
                                type: 'media',
                                multiple: true,
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes[0].media).toHaveLength(2)

            const coverMedia = result.contentTypes[0].media.find(
                m => m.name === 'cover',
            )
            expect(coverMedia).toBeDefined()
            expect(coverMedia!.multiple).toBe(false)
            expect(coverMedia!.required).toBe(true)

            const galleryMedia = result.contentTypes[0].media.find(
                m => m.name === 'gallery',
            )
            expect(galleryMedia).toBeDefined()
            expect(galleryMedia!.multiple).toBe(true)
        })

        it('should transform component fields', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::page.page': {
                        uid: 'api::page.page',
                        kind: 'collectionType',
                        collectionName: 'pages',
                        info: {
                            singularName: 'page',
                            pluralName: 'pages',
                            displayName: 'Page',
                        },
                        attributes: {
                            seo: {
                                type: 'component',
                                component: 'shared.seo',
                                repeatable: false,
                            },
                            features: {
                                type: 'component',
                                component: 'landing.feature',
                                repeatable: true,
                                required: true,
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes[0].components).toHaveLength(2)

            const seoComp = result.contentTypes[0].components.find(
                c => c.name === 'seo',
            )
            expect(seoComp).toBeDefined()
            expect(seoComp!.component).toBe('shared.seo')
            expect(seoComp!.componentType).toBe('SharedSeo')
            expect(seoComp!.repeatable).toBe(false)

            const featuresComp = result.contentTypes[0].components.find(
                c => c.name === 'features',
            )
            expect(featuresComp).toBeDefined()
            expect(featuresComp!.repeatable).toBe(true)
            expect(featuresComp!.required).toBe(true)
        })

        it('should transform dynamic zones', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::page.page': {
                        uid: 'api::page.page',
                        kind: 'collectionType',
                        collectionName: 'pages',
                        info: {
                            singularName: 'page',
                            pluralName: 'pages',
                            displayName: 'Page',
                        },
                        attributes: {
                            content: {
                                type: 'dynamiczone',
                                components: [
                                    'blocks.hero',
                                    'blocks.text',
                                    'blocks.gallery',
                                ],
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes[0].dynamicZones).toHaveLength(1)

            const contentDz = result.contentTypes[0].dynamicZones[0]
            expect(contentDz.name).toBe('content')
            expect(contentDz.components).toEqual([
                'blocks.hero',
                'blocks.text',
                'blocks.gallery',
            ])
            expect(contentDz.componentTypes).toEqual([
                'BlocksHero',
                'BlocksText',
                'BlocksGallery',
            ])
        })

        it('should transform enumerations', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::post.post': {
                        uid: 'api::post.post',
                        kind: 'collectionType',
                        collectionName: 'posts',
                        info: {
                            singularName: 'post',
                            pluralName: 'posts',
                            displayName: 'Post',
                        },
                        attributes: {
                            status: {
                                type: 'enumeration',
                                enum: ['draft', 'published', 'archived'],
                                required: true,
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            const statusAttr = result.contentTypes[0].attributes.find(
                a => a.name === 'status',
            )
            expect(statusAttr).toBeDefined()
            expect(statusAttr!.type.kind).toBe('enumeration')
            if (statusAttr!.type.kind === 'enumeration') {
                expect(statusAttr!.type.values).toEqual([
                    'draft',
                    'published',
                    'archived',
                ])
            }
        })

        it('should transform components', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {},
                components: {
                    'shared.seo': {
                        uid: 'shared.seo',
                        category: 'shared',
                        info: {
                            displayName: 'SEO',
                        },
                        attributes: {
                            title: { type: 'string', required: true },
                            description: { type: 'text' },
                            keywords: { type: 'string' },
                        },
                    },
                    'landing.hero': {
                        uid: 'landing.hero',
                        category: 'landing',
                        info: {
                            displayName: 'Hero',
                        },
                        attributes: {
                            heading: { type: 'string', required: true },
                            subheading: { type: 'text' },
                            background: { type: 'media', multiple: false },
                        },
                    },
                },
            }

            const result = transformSchema(extracted)

            expect(result.components).toHaveLength(2)

            const seoComp = result.components.find(
                c => c.cleanName === 'SharedSeo',
            )
            expect(seoComp).toBeDefined()
            expect(seoComp!.category).toBe('shared')
            expect(seoComp!.uid).toBe('shared.seo')
            expect(seoComp!.attributes).toHaveLength(3)

            const heroComp = result.components.find(
                c => c.cleanName === 'LandingHero',
            )
            expect(heroComp).toBeDefined()
            expect(heroComp!.category).toBe('landing')
            expect(heroComp!.uid).toBe('landing.hero')
            expect(heroComp!.media).toHaveLength(1)
        })

        it('should transform all scalar types correctly', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::test.test': {
                        uid: 'api::test.test',
                        kind: 'collectionType',
                        collectionName: 'tests',
                        info: {
                            singularName: 'test',
                            pluralName: 'tests',
                            displayName: 'Test',
                        },
                        attributes: {
                            stringField: { type: 'string' },
                            textField: { type: 'text' },
                            richtextField: { type: 'richtext' },
                            blocksField: { type: 'blocks' },
                            emailField: { type: 'email' },
                            passwordField: { type: 'password' },
                            uidField: { type: 'uid' },
                            integerField: { type: 'integer' },
                            bigintegerField: { type: 'biginteger' },
                            floatField: { type: 'float' },
                            decimalField: { type: 'decimal' },
                            booleanField: { type: 'boolean' },
                            dateField: { type: 'date' },
                            timeField: { type: 'time' },
                            datetimeField: { type: 'datetime' },
                            timestampField: { type: 'timestamp' },
                            jsonField: { type: 'json' },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            const attrs = result.contentTypes[0].attributes
            expect(attrs.find(a => a.name === 'stringField')!.type.kind).toBe(
                'string',
            )
            expect(attrs.find(a => a.name === 'textField')!.type.kind).toBe(
                'text',
            )
            expect(attrs.find(a => a.name === 'richtextField')!.type.kind).toBe(
                'richtext',
            )
            expect(attrs.find(a => a.name === 'blocksField')!.type.kind).toBe(
                'blocks',
            )
            expect(attrs.find(a => a.name === 'emailField')!.type.kind).toBe(
                'email',
            )
            expect(attrs.find(a => a.name === 'passwordField')).toBeUndefined()
            expect(attrs.find(a => a.name === 'uidField')!.type.kind).toBe(
                'string',
            )
            expect(attrs.find(a => a.name === 'integerField')!.type.kind).toBe(
                'integer',
            )
            expect(
                attrs.find(a => a.name === 'bigintegerField')!.type.kind,
            ).toBe('biginteger')
            expect(attrs.find(a => a.name === 'floatField')!.type.kind).toBe(
                'float',
            )
            expect(attrs.find(a => a.name === 'decimalField')!.type.kind).toBe(
                'decimal',
            )
            expect(attrs.find(a => a.name === 'booleanField')!.type.kind).toBe(
                'boolean',
            )
            expect(attrs.find(a => a.name === 'dateField')!.type.kind).toBe(
                'date',
            )
            expect(attrs.find(a => a.name === 'timeField')!.type.kind).toBe(
                'time',
            )
            expect(attrs.find(a => a.name === 'datetimeField')!.type.kind).toBe(
                'datetime',
            )
            expect(
                attrs.find(a => a.name === 'timestampField')!.type.kind,
            ).toBe('datetime')
            expect(attrs.find(a => a.name === 'jsonField')!.type.kind).toBe(
                'json',
            )
        })

        it('should transform i18n fields (locale and localizations) when present', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::page.page': {
                        uid: 'api::page.page',
                        kind: 'collectionType',
                        collectionName: 'pages',
                        info: {
                            singularName: 'page',
                            pluralName: 'pages',
                            displayName: 'Page',
                        },
                        attributes: {
                            title: { type: 'string', required: true },
                            locale: { type: 'string', required: true },
                            localizations: {
                                type: 'relation',
                                relation: 'oneToMany',
                                target: 'api::page.page',
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)
            const ct = result.contentTypes[0]

            // locale should be a regular string attribute
            const localeAttr = ct.attributes.find(a => a.name === 'locale')
            expect(localeAttr).toBeDefined()
            expect(localeAttr!.type.kind).toBe('string')
            expect(localeAttr!.required).toBe(true)

            // localizations should be a self-referencing relation
            const localizationsRel = ct.relations.find(
                r => r.name === 'localizations',
            )
            expect(localizationsRel).toBeDefined()
            expect(localizationsRel!.relationType).toBe('oneToMany')
            expect(localizationsRel!.targetType).toBe('Page')
        })

        it('should not include i18n fields when they are absent from schema', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::post.post': {
                        uid: 'api::post.post',
                        kind: 'collectionType',
                        collectionName: 'posts',
                        info: {
                            singularName: 'post',
                            pluralName: 'posts',
                            displayName: 'Post',
                        },
                        attributes: {
                            title: { type: 'string', required: true },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)
            const ct = result.contentTypes[0]

            expect(ct.attributes.find(a => a.name === 'locale')).toBeUndefined()
            expect(
                ct.relations.find(r => r.name === 'localizations'),
            ).toBeUndefined()
        })

        it('should emit content types and components in stable UID order regardless of input order', () => {
            const ct = (
                uid: string,
                singularName: string,
            ): StrapiContentType => ({
                uid,
                kind: 'collectionType',
                collectionName: singularName,
                info: {
                    singularName,
                    pluralName: `${singularName}s`,
                    displayName: singularName,
                },
                attributes: { name: { type: 'string' } },
            })
            const comp = (uid: string): StrapiComponent => ({
                uid,
                category: uid.split('.')[0],
                info: { displayName: uid },
                attributes: { label: { type: 'string' } },
            })

            const result = transformSchema({
                contentTypes: {
                    'api::zebra.zebra': ct('api::zebra.zebra', 'zebra'),
                    'api::apple.apple': ct('api::apple.apple', 'apple'),
                    'api::mango.mango': ct('api::mango.mango', 'mango'),
                },
                components: {
                    'shared.seo': comp('shared.seo'),
                    'landing.hero': comp('landing.hero'),
                    'blocks.text': comp('blocks.text'),
                },
            })

            expect(result.contentTypes.map(c => c.cleanName)).toEqual([
                'Apple',
                'Mango',
                'Zebra',
            ])
            expect(result.components.map(c => c.uid)).toEqual([
                'blocks.text',
                'landing.hero',
                'shared.seo',
            ])
        })

        it('should produce identical output order for shuffled input keys', () => {
            const ct = (
                uid: string,
                singularName: string,
            ): StrapiContentType => ({
                uid,
                kind: 'collectionType',
                collectionName: singularName,
                info: {
                    singularName,
                    pluralName: `${singularName}s`,
                    displayName: singularName,
                },
                attributes: { name: { type: 'string' } },
            })

            const a = transformSchema({
                contentTypes: {
                    'api::beta.beta': ct('api::beta.beta', 'beta'),
                    'api::alpha.alpha': ct('api::alpha.alpha', 'alpha'),
                },
                components: {},
            })
            const b = transformSchema({
                contentTypes: {
                    'api::alpha.alpha': ct('api::alpha.alpha', 'alpha'),
                    'api::beta.beta': ct('api::beta.beta', 'beta'),
                },
                components: {},
            })

            expect(a.contentTypes.map(c => c.cleanName)).toEqual(
                b.contentTypes.map(c => c.cleanName),
            )
        })

        it('should extract min/max constraints for number attributes', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::product.product': {
                        uid: 'api::product.product',
                        kind: 'collectionType',
                        collectionName: 'products',
                        info: {
                            singularName: 'product',
                            pluralName: 'products',
                            displayName: 'Product',
                        },
                        attributes: {
                            quantity: { type: 'integer', min: 0, max: 100 },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            const quantity = result.contentTypes[0].attributes.find(
                a => a.name === 'quantity',
            )
            expect(quantity).toBeDefined()
            expect(quantity!.constraints).toEqual({ min: 0, max: 100 })
        })

        it('should extract minLength/maxLength/regex for string attributes', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::product.product': {
                        uid: 'api::product.product',
                        kind: 'collectionType',
                        collectionName: 'products',
                        info: {
                            singularName: 'product',
                            pluralName: 'products',
                            displayName: 'Product',
                        },
                        attributes: {
                            slug: {
                                type: 'string',
                                minLength: 3,
                                maxLength: 50,
                                regex: '^[a-z0-9-]+$',
                            },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            const slug = result.contentTypes[0].attributes.find(
                a => a.name === 'slug',
            )
            expect(slug!.constraints).toEqual({
                minLength: 3,
                maxLength: 50,
                regex: '^[a-z0-9-]+$',
            })
        })

        it('should fill unique and defaultValue (including falsy defaults)', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::product.product': {
                        uid: 'api::product.product',
                        kind: 'collectionType',
                        collectionName: 'products',
                        info: {
                            singularName: 'product',
                            pluralName: 'products',
                            displayName: 'Product',
                        },
                        attributes: {
                            sku: { type: 'string', unique: true },
                            status: { type: 'string', default: 'draft' },
                            featured: { type: 'boolean', default: false },
                            plain: { type: 'string' },
                        },
                    },
                },
                components: {},
            }

            const attrs = transformSchema(extracted).contentTypes[0].attributes
            const get = (n: string) => attrs.find(a => a.name === n)!

            expect(get('sku').unique).toBe(true)
            expect(get('status').defaultValue).toBe('draft')
            expect(get('featured').defaultValue).toBe(false)

            // No constraints/unique/default declared -> stays clean
            expect(get('plain').unique).toBeUndefined()
            expect(get('plain').defaultValue).toBeUndefined()
            expect(get('plain').constraints).toBeUndefined()
        })

        it('should handle kebab-case names correctly', () => {
            const extracted: ExtractedSchema = {
                contentTypes: {
                    'api::guide-type.guide-type': {
                        uid: 'api::guide-type.guide-type',
                        kind: 'collectionType',
                        collectionName: 'guide_types',
                        info: {
                            singularName: 'guide-type',
                            pluralName: 'guide-types',
                            displayName: 'Guide Type',
                        },
                        attributes: {
                            name: { type: 'string' },
                        },
                    },
                },
                components: {},
            }

            const result = transformSchema(extracted)

            expect(result.contentTypes[0].cleanName).toBe('GuideType')
        })
    })
})
