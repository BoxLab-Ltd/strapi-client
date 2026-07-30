import { describe, it, expect } from 'vitest'
import {
    generateFilterUtilityTypes,
    generateEntityFilters,
    generateComponentFilters,
    generateTypedQueryParams,
} from '../../../src/core/generator/filters-generator'
import { ContentType, Component } from '../../../src/schema-types'

describe('filters-generator', () => {
    describe('generateFilterUtilityTypes', () => {
        it('generates string filter operators', () => {
            const result = generateFilterUtilityTypes()
            expect(result).toContain('StringFilterOperators')
            expect(result).toContain('$eq?: string')
            expect(result).toContain('$contains?: string')
            expect(result).toContain('$startsWith?: string')
        })

        it('generates number filter operators', () => {
            const result = generateFilterUtilityTypes()
            expect(result).toContain('NumberFilterOperators')
            expect(result).toContain('$lt?: number')
            expect(result).toContain('$gte?: number')
            expect(result).toContain('$between?: [number, number]')
        })

        it('generates boolean filter operators', () => {
            const result = generateFilterUtilityTypes()
            expect(result).toContain('BooleanFilterOperators')
            expect(result).toContain('$eq?: boolean')
        })

        it('generates date filter operators', () => {
            const result = generateFilterUtilityTypes()
            expect(result).toContain('DateFilterOperators')
        })

        it('generates logical operators', () => {
            const result = generateFilterUtilityTypes()
            expect(result).toContain('LogicalOperators')
            expect(result).toContain('$and')
            expect(result).toContain('$or')
            expect(result).toContain('$not')
        })
    })

    describe('generateEntityFilters', () => {
        const mockContentType: ContentType = {
            name: 'ApiItemItem',
            cleanName: 'Item',
            kind: 'collection',
            collectionName: 'items',
            singularName: 'item',
            pluralName: 'items',
            attributes: [
                { name: 'title', type: { kind: 'string' }, required: true },
                { name: 'price', type: { kind: 'integer' }, required: false },
                {
                    name: 'published',
                    type: { kind: 'boolean' },
                    required: false,
                },
                {
                    name: 'createdDate',
                    type: { kind: 'datetime' },
                    required: false,
                },
                {
                    name: 'status',
                    type: {
                        kind: 'enumeration',
                        values: ['draft', 'published', 'archived'],
                    },
                    required: true,
                },
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
            components: [
                {
                    name: 'target',
                    component: 'shared.target',
                    componentType: 'SharedTarget',
                    repeatable: false,
                    required: false,
                },
                {
                    name: 'slots',
                    component: 'shared.slot',
                    componentType: 'SharedSlot',
                    repeatable: true,
                    required: false,
                },
            ],
            dynamicZones: [
                {
                    name: 'blocks',
                    components: ['shared.target'],
                    componentTypes: ['SharedTarget'],
                    required: false,
                },
            ],
        }

        it('generates filter interface with correct name', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('export interface ItemFilters')
        })

        it('includes id and documentId filters', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('id?: number | IdFilterOperators')
            expect(result).toContain(
                'documentId?: string | StringFilterOperators',
            )
        })

        it('generates string attribute filters', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('title?: string | StringFilterOperators')
        })

        it('generates number attribute filters', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('price?: number | NumberFilterOperators')
        })

        it('generates boolean attribute filters', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain(
                'published?: boolean | BooleanFilterOperators',
            )
        })

        it('generates enumeration filters with values', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain(
                "status?: ('draft' | 'published' | 'archived') | StringFilterOperators",
            )
        })

        it('generates relation filters', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('category?: {')
            expect(result).toContain('id?: number | IdFilterOperators')
        })

        it('generates media filters', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('image?: {')
        })

        it('generates component filters referencing the component filter type', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('target?: SharedTargetFilters')
        })

        it('gives a repeatable component the same shape as a single one', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('slots?: SharedSlotFilters')
        })

        it('omits dynamic zones — Strapi cannot filter polymorphic structures', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).not.toContain('blocks?')
        })

        it('generates timestamp filters', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('createdAt?: string | DateFilterOperators')
            expect(result).toContain('updatedAt?: string | DateFilterOperators')
            expect(result).toContain(
                'publishedAt?: string | DateFilterOperators',
            )
        })

        it('extends LogicalOperators', () => {
            const result = generateEntityFilters(mockContentType)
            expect(result).toContain('extends LogicalOperators<ItemFilters>')
        })
    })

    describe('generateComponentFilters', () => {
        const mockComponent: Component = {
            name: 'SharedTarget',
            cleanName: 'SharedTarget',
            category: 'shared',
            uid: 'shared.target',
            attributes: [
                {
                    name: 'startDateTime',
                    type: { kind: 'datetime' },
                    required: false,
                },
            ],
            relations: [
                {
                    name: 'owner',
                    relationType: 'manyToOne',
                    target: 'api::item.item',
                    targetType: 'Item',
                    required: false,
                },
            ],
            media: [],
            components: [
                {
                    name: 'inner',
                    component: 'shared.inner',
                    componentType: 'SharedInner',
                    repeatable: false,
                    required: false,
                },
            ],
            dynamicZones: [],
        }

        it('generates a filter interface for the component', () => {
            const result = generateComponentFilters(mockComponent)
            expect(result).toContain('export interface SharedTargetFilters')
            expect(result).toContain(
                'extends LogicalOperators<SharedTargetFilters>',
            )
        })

        it('generates attribute filters', () => {
            const result = generateComponentFilters(mockComponent)
            expect(result).toContain(
                'startDateTime?: string | DateFilterOperators',
            )
        })

        it('nests component filters recursively', () => {
            const result = generateComponentFilters(mockComponent)
            expect(result).toContain('inner?: SharedInnerFilters')
        })

        // Anchored to line starts — the inline relation filter has its own nested documentId.
        it('carries a numeric id but no documentId or timestamps', () => {
            const result = generateComponentFilters(mockComponent)
            expect(result).toContain('id?: number | IdFilterOperators')
            expect(result).not.toMatch(/^\s+documentId\?/m)
            expect(result).not.toMatch(/^\s+createdAt\?/m)
        })
    })

    describe('generateTypedQueryParams', () => {
        it('generates TypedQueryParams interface', () => {
            const result = generateTypedQueryParams()
            expect(result).toContain('TypedQueryParams')
            expect(result).toContain('TEntity')
            expect(result).toContain('TFilters')
            expect(result).toContain('TPopulate')
        })

        it('includes filters field', () => {
            const result = generateTypedQueryParams()
            expect(result).toContain('filters?: TFilters')
        })

        it('includes sort field with SortOption type', () => {
            const result = generateTypedQueryParams()
            expect(result).toContain('SortOption')
            expect(result).toContain('SortDirection')
            expect(result).toContain('sort?: SortOption<TEntity>')
        })

        it('includes pagination field', () => {
            const result = generateTypedQueryParams()
            expect(result).toContain('pagination?')
            expect(result).toContain('page?: number')
            expect(result).toContain('pageSize?: number')
        })

        it('includes fields selection', () => {
            const result = generateTypedQueryParams()
            expect(result).toContain('fields?: (keyof TEntity)[]')
        })
    })
})
